// Package amneziawg runs AmneziaWG-go sidecar processes on the SharX panel/node host.
//
// Architecture (mirrors node/telemt):
//   - Protocol `amneziawg` in the panel — NOT emitted into Xray JSON.
//   - One OS process per inbound: amneziawg-go -f awg-{tag} (userspace from github.com/amnezia-vpn/amneziawg-go).
//   - Config applied via amneziawg-tools (`awg setconf` / wg-quick-compatible .conf with Jc/H/S params).
//   - Subscription page exports .conf + QR for the AmneziaWG mobile/desktop app.
//
// Why not Xray fork: stock Xray WireGuard is plain WG; AmneziaWG obfuscation lives in amneziawg-go / kernel module.
package amneziawg

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/konstpic/sharx-code/v2/logger"
)

const sidecarStopTimeout = 8 * time.Second

// Payload is one inbound's awg-quick config and interface name.
type Payload struct {
	InboundId int    `json:"inboundId"`
	Tag       string `json:"tag"`
	Conf      string `json:"conf"`
	Iface     string `json:"iface"`
}

// Manager supervises one amneziawg-go process per inbound tag.
type Manager struct {
	mu       sync.Mutex
	running  map[string]*procState
	workRoot string

	replayMu sync.RWMutex
	replay   []Payload
	replayOK bool
}

// SetWorkRoot sets per-manager state directory (panel: $XUI_DATA_FOLDER/amneziawg).
func (m *Manager) SetWorkRoot(root string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.workRoot = strings.TrimSpace(root)
}

// RunningCount returns supervised sidecar tags.
func (m *Manager) RunningCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.running)
}

type procState struct {
	cancel context.CancelFunc
	hash   string
	cmd    *exec.Cmd
	iface  string
	done   chan struct{}
}

// NewManager creates an AmneziaWG sidecar manager.
func NewManager() *Manager {
	return &Manager{running: make(map[string]*procState)}
}

func (m *Manager) commitReplaySnapshot(payloads []Payload) {
	if m == nil {
		return
	}
	cp := append([]Payload(nil), payloads...)
	m.replayMu.Lock()
	m.replay = cp
	m.replayOK = true
	m.replayMu.Unlock()
}

// ReplaySnapshotForRestart returns the last payloads successfully applied to this Manager, if any.
func (m *Manager) ReplaySnapshotForRestart() ([]Payload, bool) {
	if m == nil {
		return nil, false
	}
	m.replayMu.RLock()
	defer m.replayMu.RUnlock()
	if !m.replayOK {
		return nil, false
	}
	return append([]Payload(nil), m.replay...), true
}

func findAmneziaWgBinary() string {
	if p := strings.TrimSpace(os.Getenv("AMNEZIAWG_BIN")); p != "" {
		return p
	}
	for _, c := range []string{"/app/bin/amneziawg-go", "bin/amneziawg-go", "./bin/amneziawg-go"} {
		if st, err := os.Stat(c); err == nil && !st.IsDir() {
			return c
		}
	}
	return ""
}

func findAwgBinary() string {
	if p := strings.TrimSpace(os.Getenv("AWG_BIN")); p != "" {
		return p
	}
	for _, c := range []string{"/app/bin/awg", "bin/awg", "./bin/awg"} {
		if st, err := os.Stat(c); err == nil && !st.IsDir() {
			return c
		}
	}
	return ""
}

func teardownWireGuardIface(iface string) {
	iface = strings.TrimSpace(iface)
	if iface == "" {
		return
	}
	if out, err := exec.Command("ip", "link", "delete", iface).CombinedOutput(); err != nil {
		msg := strings.TrimSpace(string(out))
		if msg != "" && !strings.Contains(msg, "Cannot find device") {
			logger.Debugf("amneziawg: ip link delete %s: %v (%s)", iface, err, msg)
		}
	}
}

func tunnelSubnetFromConf(conf string) string {
	for _, line := range strings.Split(conf, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "Address = ") {
			continue
		}
		addr := strings.TrimSpace(strings.TrimPrefix(line, "Address = "))
		if addr == "" {
			break
		}
		if !strings.Contains(addr, "/") {
			return addr + "/24"
		}
		_, ipnet, err := net.ParseCIDR(addr)
		if err != nil || ipnet == nil {
			return addr
		}
		return ipnet.String()
	}
	return "10.8.0.0/24"
}

func iptablesHasRule(table string, args ...string) bool {
	cmdArgs := []string{"-C"}
	if table != "" {
		cmdArgs = append(cmdArgs, "-t", table)
	}
	cmdArgs = append(cmdArgs, args...)
	return exec.Command("iptables", cmdArgs...).Run() == nil
}

func iptablesEnsureAppend(table string, args ...string) {
	if iptablesHasRule(table, args...) {
		return
	}
	cmdArgs := []string{"-A"}
	if table != "" {
		cmdArgs = append(cmdArgs, "-t", table)
	}
	cmdArgs = append(cmdArgs, args...)
	if out, err := exec.Command("iptables", cmdArgs...).CombinedOutput(); err != nil {
		logger.Warningf("amneziawg iptables append %v: %v (%s)", args, err, strings.TrimSpace(string(out)))
	}
}

// ensureTunnelRouting enables forward + NAT for the sidecar TUN (awg setconf does not run PostUp hooks).
func ensureTunnelRouting(iface, subnet string) {
	iface = strings.TrimSpace(iface)
	subnet = strings.TrimSpace(subnet)
	if iface == "" {
		return
	}
	if subnet == "" {
		subnet = "10.8.0.0/24"
	}
	if out, err := exec.Command("sysctl", "-w", "net.ipv4.ip_forward=1").CombinedOutput(); err != nil {
		logger.Warningf("amneziawg sysctl ip_forward: %v (%s)", err, strings.TrimSpace(string(out)))
	}
	iptablesEnsureAppend("", "FORWARD", "-i", iface, "-j", "ACCEPT")
	iptablesEnsureAppend("", "FORWARD", "-o", iface, "-j", "ACCEPT")
	iptablesEnsureAppend("nat", "POSTROUTING", "-s", subnet, "-j", "MASQUERADE")
	logger.Infof("amneziawg routing OK: iface=%s subnet=%s", iface, subnet)
}

func (m *Manager) stopProc(st *procState) {
	if st == nil {
		return
	}
	if st.cancel != nil {
		st.cancel()
	}
	if st.done != nil {
		select {
		case <-st.done:
		case <-time.After(sidecarStopTimeout):
			if st.cmd != nil && st.cmd.Process != nil {
				_ = st.cmd.Process.Kill()
				select {
				case <-st.done:
				case <-time.After(2 * time.Second):
				}
			}
		}
	}
	teardownWireGuardIface(st.iface)
}

// Apply starts or updates sidecars.
func (m *Manager) Apply(payloads []Payload) error {
	m.mu.Lock()
	if len(payloads) == 0 {
		for tag, st := range m.running {
			m.stopProc(st)
			delete(m.running, tag)
		}
		m.mu.Unlock()
		m.commitReplaySnapshot(nil)
		return nil
	}
	m.mu.Unlock()

	bin := findAmneziaWgBinary()
	if bin == "" {
		return errors.New("amneziawg-go binary not found (build to /app/bin/amneziawg-go or set AMNEZIAWG_BIN)")
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	want := make(map[string]Payload)
	for _, p := range payloads {
		tag := strings.TrimSpace(p.Tag)
		if tag == "" {
			continue
		}
		want[tag] = p
	}

	for tag, st := range m.running {
		if _, ok := want[tag]; !ok {
			m.stopProc(st)
			delete(m.running, tag)
		}
	}

	root := strings.TrimSpace(m.workRoot)
	if root == "" {
		root = strings.TrimSpace(os.Getenv("AMNEZIAWG_WORK_ROOT"))
	}
	if root == "" {
		root = "/app/amneziawg"
	}

	for tag, p := range want {
		conf := p.Conf
		h := sha256.Sum256([]byte(conf))
		hhex := hex.EncodeToString(h[:])

		iface := strings.TrimSpace(p.Iface)
		if iface == "" {
			iface = ifaceForPayload(p)
		}

		if cur, ok := m.running[tag]; ok && cur != nil && cur.hash == hhex {
			continue
		}
		if cur, ok := m.running[tag]; ok {
			m.stopProc(cur)
			delete(m.running, tag)
		}
		// Stale TUN from a prior crash / kernel AWG module may still hold the name.
		teardownWireGuardIface(iface)

		stateDir := filepath.Join(root, tag)
		if err := os.MkdirAll(stateDir, 0o755); err != nil {
			return fmt.Errorf("amneziawg mkdir %s: %w", stateDir, err)
		}
		confPath := filepath.Join(stateDir, iface+".conf")
		if err := os.WriteFile(confPath, []byte(conf), 0o600); err != nil {
			return fmt.Errorf("amneziawg write conf: %w", err)
		}

		ctx, cancel := context.WithCancel(context.Background())
		cmd := exec.CommandContext(ctx, bin, "-f", iface)
		cmd.Dir = stateDir
		cmd.Env = os.Environ()
		cmd.Stdout = os.Stderr
		cmd.Stderr = os.Stderr

		done := make(chan struct{})
		if err := cmd.Start(); err != nil {
			cancel()
			close(done)
			return fmt.Errorf("amneziawg-go start %s: %w", tag, err)
		}
		go func(tag string, cmd *exec.Cmd, waitCtx context.Context, done chan struct{}) {
			defer close(done)
			err := cmd.Wait()
			if err != nil && waitCtx.Err() == nil {
				logger.Warningf("AmneziaWG-go exited: tag=%s err=%v", tag, err)
			}
		}(tag, cmd, ctx, done)

		// UAPI socket must exist before awg setconf.
		if awg := findAwgBinary(); awg != "" && conf != "" {
			out, err := exec.Command(awg, "setconf", iface, confPath).CombinedOutput()
			if err != nil {
				logger.Warningf("amneziawg setconf %s iface=%s: %v (%s)", tag, iface, err, strings.TrimSpace(string(out)))
			} else {
				logger.Infof("amneziawg setconf OK: tag=%s iface=%s", tag, iface)
				ensureTunnelRouting(iface, tunnelSubnetFromConf(conf))
				if showOut, showErr := exec.Command(awg, "show", iface).CombinedOutput(); showErr == nil {
					lines := strings.Count(strings.TrimSpace(string(showOut)), "\n") + 1
					logger.Infof("amneziawg show %s: %d line(s)", iface, lines)
				}
			}
		} else if awg == "" {
			logger.Warningf("amneziawg: awg binary not found — sidecar %s started but setconf skipped", tag)
		}
		logger.Infof("AmneziaWG-go started: tag=%s iface=%s pid=%d", tag, iface, cmd.Process.Pid)

		m.running[tag] = &procState{cancel: cancel, hash: hhex, cmd: cmd, iface: iface, done: done}
	}
	m.commitReplaySnapshot(payloads)
	return nil
}

func ifaceForPayload(p Payload) string {
	if p.InboundId > 0 {
		return fmt.Sprintf("awg%d", p.InboundId)
	}
	tag := strings.TrimSpace(p.Tag)
	if tag == "" {
		return "awg0"
	}
	return "awg-" + sanitizeIface(tag)
}

func sanitizeIface(tag string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(tag) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		} else if r == '-' || r == '_' {
			b.WriteRune('-')
		}
	}
	s := b.String()
	if s == "" {
		return "0"
	}
	if len(s) > 12 {
		s = s[:12]
	}
	return s
}

// Stop shuts down all AmneziaWG sidecars.
func (m *Manager) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for tag, st := range m.running {
		m.stopProc(st)
		delete(m.running, tag)
	}
}
