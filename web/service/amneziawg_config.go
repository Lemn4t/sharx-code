package service

import (
	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/konstpic/sharx-code/v2/database"
	"github.com/konstpic/sharx-code/v2/database/model"
)

// AmneziaWGObfuscation holds transport-layer AWG params (Jc/H/S). Server and client must match.
// See https://docs.amnezia.org/documentation/amnezia-wg/
type AmneziaWGObfuscation struct {
	Jc   int `json:"jc,omitempty"`
	Jmin int `json:"jmin,omitempty"`
	Jmax int `json:"jmax,omitempty"`
	S1   int `json:"s1,omitempty"`
	S2   int `json:"s2,omitempty"`
	S3   int `json:"s3,omitempty"`
	S4   int `json:"s4,omitempty"`
	H1   int `json:"h1,omitempty"`
	H2   int `json:"h2,omitempty"`
	H3   int `json:"h3,omitempty"`
	H4   int `json:"h4,omitempty"`
}

// AmneziaWGInboundSettings is panel JSON for protocol `amneziawg` (sidecar, not Xray).
type AmneziaWGInboundSettings struct {
	ListenPort   int                    `json:"listenPort"`
	MTU          int                    `json:"mtu"`
	SecretKey    string                 `json:"secretKey"`
	Address      []string               `json:"address"`
	ClientDNS    []string               `json:"clientDns,omitempty"`
	Obfuscation  AmneziaWGObfuscation   `json:"obfuscation"`
	Peers        []AmneziaWGPeerSettings `json:"peers,omitempty"`
	PanelInactivePeers []AmneziaWGPeerSettings `json:"panelWgInactivePeers,omitempty"`
}

type AmneziaWGPeerSettings struct {
	Name         string   `json:"name,omitempty"`
	PublicKey    string   `json:"publicKey"`
	PrivateKey   string   `json:"privateKey,omitempty"`
	PreSharedKey string   `json:"preSharedKey,omitempty"`
	AllowedIPs   []string `json:"allowedIPs,omitempty"`
	KeepAlive    int      `json:"keepAlive,omitempty"`
}

// RandomAmneziaWGObfuscation returns DPI-oriented defaults.
func RandomAmneziaWGObfuscation() AmneziaWGObfuscation {
	return AmneziaWGObfuscation{
		Jc:   4,
		Jmin: 40,
		Jmax: 70,
		S1:   randomIntRange(50, 120),
		S2:   randomIntRange(0, 40),
		H1:   randomUint32(),
		H2:   randomUint32(),
		H3:   randomUint32(),
		H4:   randomUint32(),
	}
}

func randomIntRange(min, max int) int {
	if max <= min {
		return min
	}
	var b [4]byte
	_, _ = rand.Read(b[:])
	return min + int(binary.BigEndian.Uint32(b[:])%uint32(max-min+1))
}

func randomUint32() int {
	var b [4]byte
	_, _ = rand.Read(b[:])
	v := binary.BigEndian.Uint32(b[:])
	if v == 0 {
		return 1286472620
	}
	return int(v)
}

// AppendAmneziaWGObfuscationToConf writes AWG key=value lines into a wg-quick [Interface] section.
func AppendAmneziaWGObfuscationToConf(b *strings.Builder, o AmneziaWGObfuscation) {
	writeInt := func(key string, val int) {
		if val != 0 {
			b.WriteString(fmt.Sprintf("%s = %d\n", key, val))
		}
	}
	writeInt("Jc", o.Jc)
	writeInt("Jmin", o.Jmin)
	writeInt("Jmax", o.Jmax)
	writeInt("S1", o.S1)
	writeInt("S2", o.S2)
	writeInt("S3", o.S3)
	writeInt("S4", o.S4)
	writeInt("H1", o.H1)
	writeInt("H2", o.H2)
	writeInt("H3", o.H3)
	writeInt("H4", o.H4)
}

// ParseAmneziaWGInboundSettings parses inbound settings JSON for protocol amneziawg.
func ParseAmneziaWGInboundSettings(settingsJSON string) (*AmneziaWGInboundSettings, error) {
	settingsJSON = strings.TrimSpace(settingsJSON)
	if settingsJSON == "" {
		return &AmneziaWGInboundSettings{MTU: 1420, Address: []string{"10.8.0.1/24"}}, nil
	}
	var out AmneziaWGInboundSettings
	if err := json.Unmarshal([]byte(settingsJSON), &out); err != nil {
		return nil, err
	}
	if out.MTU <= 0 {
		out.MTU = 1420
	}
	if len(out.Address) == 0 {
		out.Address = []string{"10.8.0.1/24"}
	}
	return &out, nil
}

// AmneziaWGInboundRequest is the panel form payload for protocol amneziawg.
type AmneziaWGInboundRequest struct {
	MTU         int                    `json:"mtu"`
	SecretKey   string                 `json:"secretKey"`
	Address     []string               `json:"address"`
	ClientDNS   []string               `json:"clientDns"`
	Obfuscation *AmneziaWGObfuscation  `json:"obfuscation,omitempty"`
}

const defaultAmneziaWGMTU = 1420

// BuildAmneziaWGInboundSettingsJSON builds inbound `settings` JSON for protocol amneziawg.
func BuildAmneziaWGInboundSettingsJSON(r *AmneziaWGInboundRequest) (string, error) {
	if r == nil {
		r = &AmneziaWGInboundRequest{}
	}
	mtu := r.MTU
	if mtu <= 0 {
		mtu = defaultAmneziaWGMTU
	}
	sk := strings.TrimSpace(r.SecretKey)
	if sk == "" {
		var err error
		sk, err = RandomWireGuardSecretKeyBase64()
		if err != nil {
			return "", err
		}
	}
	addrs := make([]string, 0, len(r.Address))
	for _, a := range r.Address {
		t := strings.TrimSpace(a)
		if t != "" {
			addrs = append(addrs, t)
		}
	}
	if len(addrs) == 0 {
		addrs = []string{"10.8.0.1/24"}
	}
	dns := normalizeWireGuardClientDNSList(r.ClientDNS)
	obf := AmneziaWGObfuscation{}
	if r.Obfuscation != nil {
		obf = *r.Obfuscation
	}
	out := AmneziaWGInboundSettings{
		MTU:         mtu,
		SecretKey:   sk,
		Address:     addrs,
		ClientDNS:   dns,
		Obfuscation: obf,
		Peers:       []AmneziaWGPeerSettings{},
	}
	b, err := json.Marshal(out)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// AmneziaWGNodePayload is one sidecar instance pushed to workers / applied locally.
type AmneziaWGNodePayload struct {
	InboundId int    `json:"inboundId"`
	Tag       string `json:"tag"`
	Conf      string `json:"conf"`
	Iface     string `json:"iface"`
}

func amneziaWgIfaceForTag(tag string) string {
	tag = strings.ToLower(strings.TrimSpace(tag))
	var b strings.Builder
	b.WriteString("awg")
	for _, r := range tag {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	s := b.String()
	if len(s) > 14 {
		s = s[:14]
	}
	if s == "awg" {
		return "awg0"
	}
	return s
}

// BuildAmneziaWGServerConf renders awg-quick server config from merged inbound settings.
func BuildAmneziaWGServerConf(inbound *model.Inbound, settings map[string]any, listenPort int) (string, error) {
	if settings == nil {
		return "", fmt.Errorf("empty settings")
	}
	b, _ := json.Marshal(settings)
	st, err := ParseAmneziaWGInboundSettings(string(b))
	if err != nil {
		return "", err
	}
	if listenPort <= 0 && inbound != nil {
		listenPort = inbound.Port
	}
	sk := strings.TrimSpace(st.SecretKey)
	if sk == "" {
		return "", fmt.Errorf("missing secretKey")
	}
	serverPub, err := wireguardPeerPublicKeyFromPrivateB64(sk)
	if err != nil {
		return "", err
	}
	var out strings.Builder
	out.WriteString("[Interface]\n")
	out.WriteString("PrivateKey = " + sk + "\n")
	if len(st.Address) > 0 {
		out.WriteString("Address = " + strings.TrimSpace(st.Address[0]) + "\n")
	}
	if listenPort > 0 {
		out.WriteString(fmt.Sprintf("ListenPort = %d\n", listenPort))
	}
	if st.MTU > 0 {
		out.WriteString(fmt.Sprintf("MTU = %d\n", st.MTU))
	}
	AppendAmneziaWGObfuscationToConf(&out, st.Obfuscation)
	peers, _ := settings["peers"].([]any)
	for _, p := range peers {
		pm, ok := p.(map[string]any)
		if !ok {
			continue
		}
		pk, _ := pm["publicKey"].(string)
		pk = strings.TrimSpace(pk)
		if pk == "" {
			continue
		}
		out.WriteString("\n[Peer]\n")
		out.WriteString("PublicKey = " + pk + "\n")
		if aip, ok := pm["allowedIPs"].([]any); ok && len(aip) > 0 {
			parts := make([]string, 0, len(aip))
			for _, x := range aip {
				parts = append(parts, fmt.Sprint(x))
			}
			out.WriteString("AllowedIPs = " + strings.Join(parts, ", ") + "\n")
		} else {
			out.WriteString("AllowedIPs = " + pk + "/32\n")
		}
		if psk, _ := pm["preSharedKey"].(string); strings.TrimSpace(psk) != "" {
			out.WriteString("PresharedKey = " + strings.TrimSpace(psk) + "\n")
		}
		if ka := anyToInt(pm["keepAlive"]); ka > 0 {
			out.WriteString(fmt.Sprintf("PersistentKeepalive = %d\n", ka))
		}
	}
	_ = serverPub
	return strings.TrimSpace(out.String()) + "\n", nil
}

// BuildAmneziaWgPayloadsStandalone builds sidecar payloads for all enabled amneziawg inbounds (panel host).
func BuildAmneziaWgPayloadsStandalone() ([]AmneziaWGNodePayload, error) {
	db := database.GetDB()
	var inbounds []model.Inbound
	if err := db.Where("enable = ?", true).Find(&inbounds).Error; err != nil {
		return nil, err
	}
	cs := ClientService{}
	out := make([]AmneziaWGNodePayload, 0)
	for i := range inbounds {
		ib := &inbounds[i]
		if model.NormalizeProtocol(ib.Protocol) != model.AmneziaWG {
			continue
		}
		clients, err := cs.GetClientsForInbound(ib.Id)
		if err != nil {
			return nil, err
		}
		is := InboundService{}
		settingsJSON, err := is.BuildSettingsFromClientEntities(ib, clients)
		if err != nil {
			return nil, err
		}
		var settings map[string]any
		if err := json.Unmarshal([]byte(settingsJSON), &settings); err != nil {
			return nil, err
		}
		conf, err := BuildAmneziaWGServerConf(ib, settings, ib.Port)
		if err != nil {
			return nil, err
		}
		tag := strings.TrimSpace(ib.Tag)
		if tag == "" {
			continue
		}
		out = append(out, AmneziaWGNodePayload{
			InboundId: ib.Id,
			Tag:       tag,
			Conf:      conf,
			Iface:     amneziaWgIfaceForTag(tag),
		})
	}
	return out, nil
}

// BuildAmneziaWgPayloadsForNode builds AmneziaWG payloads for inbounds assigned to a worker node.
func BuildAmneziaWgPayloadsForNode(node *model.Node, ibs []*model.Inbound) ([]AmneziaWGNodePayload, error) {
	if node == nil {
		return []AmneziaWGNodePayload{}, nil
	}
	ns := NodeService{}
	cs := ClientService{}
	is := InboundService{}
	out := make([]AmneziaWGNodePayload, 0)
	for _, ib := range ibs {
		if ib == nil || !ib.Enable || model.NormalizeProtocol(ib.Protocol) != model.AmneziaWG {
			continue
		}
		clients, err := cs.GetClientsForInbound(ib.Id)
		if err != nil {
			return nil, err
		}
		settingsJSON, err := is.BuildSettingsFromClientEntities(ib, clients)
		if err != nil {
			return nil, err
		}
		var settings map[string]any
		if err := json.Unmarshal([]byte(settingsJSON), &settings); err != nil {
			return nil, err
		}
		port := ib.Port
		views, err := ns.GetInboundNodeBindingViews(ib.Id)
		if err == nil {
			for _, v := range views {
				if v.NodeId == node.Id && v.PublishedPort > 0 {
					port = v.PublishedPort
					break
				}
			}
		}
		conf, err := BuildAmneziaWGServerConf(ib, settings, port)
		if err != nil {
			return nil, err
		}
		tag := strings.TrimSpace(ib.Tag)
		if tag == "" {
			continue
		}
		out = append(out, AmneziaWGNodePayload{
			InboundId: ib.Id,
			Tag:       tag,
			Conf:      conf,
			Iface:     amneziaWgIfaceForTag(tag),
		})
	}
	return out, nil
}

// PreviewAmneziaWgConf returns server .conf for an inbound draft (inbound add/update preview).
func PreviewAmneziaWgConf(inbound *model.Inbound) (string, error) {
	if inbound == nil || model.NormalizeProtocol(inbound.Protocol) != model.AmneziaWG {
		return "", fmt.Errorf("not an amneziawg inbound")
	}
	var settings map[string]any
	if err := json.Unmarshal([]byte(strings.TrimSpace(inbound.Settings)), &settings); err != nil {
		return "", err
	}
	return BuildAmneziaWGServerConf(inbound, settings, inbound.Port)
}
