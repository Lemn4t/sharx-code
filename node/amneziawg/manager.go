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
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	"github.com/konstpic/sharx-code/v2/logger"
)

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

// Apply starts or updates sidecars.
func (m *Manager) Apply(payloads []Payload) error {
	m.mu.Lock()
	if len(payloads) == 0 {
		for tag, st := range m.running {
			if st != nil && st.cancel != nil {
				st.cancel()
			}
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
			if st != nil && st.cancel != nil {
				st.cancel()
			}
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
		if cur, ok := m.running[tag]; ok && cur != nil && cur.hash == hhex {
			continue
		}
		if cur, ok := m.running[tag]; ok && cur != nil && cur.cancel != nil {
			cur.cancel()
			delete(m.running, tag)
		}

		iface := strings.TrimSpace(p.Iface)
		if iface == "" {
			iface = "awg-" + sanitizeIface(tag)
		}

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
		if err := cmd.Start(); err != nil {
			cancel()
			return fmt.Errorf("amneziawg-go start %s: %w", tag, err)
		}
		// UAPI socket must exist before awg setconf.
		if awg := findAwgBinary(); awg != "" && conf != "" {
			if err := exec.Command(awg, "setconf", iface, confPath).Run(); err != nil {
				logger.Warningf("amneziawg setconf %s: %v", tag, err)
			}
		}
		logger.Infof("AmneziaWG-go started: tag=%s iface=%s pid=%d", tag, iface, cmd.Process.Pid)
		go func(tag string, cmd *exec.Cmd, waitCtx context.Context) {
			err := cmd.Wait()
			if err != nil && waitCtx.Err() == nil {
				logger.Warningf("AmneziaWG-go exited: tag=%s err=%v", tag, err)
			}
		}(tag, cmd, ctx)

		m.running[tag] = &procState{cancel: cancel, hash: hhex}
	}
	m.commitReplaySnapshot(payloads)
	return nil
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
		if st != nil && st.cancel != nil {
			st.cancel()
		}
		delete(m.running, tag)
	}
}
