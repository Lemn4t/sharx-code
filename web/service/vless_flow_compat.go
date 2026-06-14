package service

import (
	"encoding/json"
	"strings"

	"github.com/konstpic/sharx-code/v2/database/model"
)

// VLESSXTLSFlowAllowed reports whether xtls-rprx-* flow may be used for this inbound.
// Per Xray docs, XTLS vision applies to TCP+TLS/REALITY or VLESS Encryption (not XHTTP/WS/gRPC/etc.).
// See https://xtls.github.io/ru/config/outbounds/vless.html
func VLESSXTLSFlowAllowed(protocol model.Protocol, streamSettingsJSON, inboundSettingsJSON string) bool {
	if model.NormalizeProtocol(protocol) != model.VLESS {
		return false
	}
	network, security := parseStreamNetworkSecurity(streamSettingsJSON)
	if network == "xhttp" {
		return false
	}
	if network != "tcp" {
		return false
	}
	if security == "tls" || security == "reality" {
		return true
	}
	enc := vlessEncryptionFromSettings(inboundSettingsJSON)
	return enc != "" && enc != "none"
}

// VLESSEffectiveFlow returns stored VLESS flow only when allowed for the inbound transport.
func VLESSEffectiveFlow(inboundSettingsJSON, streamSettingsJSON string, protocol model.Protocol) string {
	if !VLESSXTLSFlowAllowed(protocol, streamSettingsJSON, inboundSettingsJSON) {
		return ""
	}
	return VLESSFlowFromInboundSettings(inboundSettingsJSON)
}

// SanitizeVLESSFlowInInboundSettings enforces a single consistent flow value across all
// settings.clients[] entries. Call before persisting VLESS inbounds.
//
// The effective flow is determined as follows:
//  1. If XTLS flow is not allowed for this transport → clear all clients' flow.
//  2. Otherwise use settings.clients[0].flow as the authoritative value (this is what
//     the panel form always writes when the user changes the flow selector), then
//     propagate that value to every other client entry. This prevents stale non-empty
//     flow values in clients[1..N] from overriding an explicit "None" selection in the UI.
func SanitizeVLESSFlowInInboundSettings(inbound *model.Inbound) {
	if inbound == nil || model.NormalizeProtocol(inbound.Protocol) != model.VLESS {
		return
	}
	settingsJSON := strings.TrimSpace(inbound.Settings)
	if settingsJSON == "" || settingsJSON == "{}" {
		return
	}
	var settings map[string]any
	if err := json.Unmarshal([]byte(settingsJSON), &settings); err != nil || settings == nil {
		return
	}
	rawClients, ok := settings["clients"].([]any)
	if !ok || len(rawClients) == 0 {
		return
	}

	// Determine effective flow:
	// - If transport disallows XTLS → always empty.
	// - Otherwise: use clients[0].flow (the value the form just wrote).
	var effective string
	if VLESSXTLSFlowAllowed(inbound.Protocol, inbound.StreamSettings, inbound.Settings) {
		if cm0, ok := rawClients[0].(map[string]any); ok {
			effective, _ = cm0["flow"].(string)
			effective = strings.TrimSpace(effective)
		}
	}

	// Apply effective to ALL clients.
	changed := false
	for i, cl := range rawClients {
		cm, ok := cl.(map[string]any)
		if !ok || cm == nil {
			continue
		}
		cur, _ := cm["flow"].(string)
		cur = strings.TrimSpace(cur)
		if cur == effective {
			continue
		}
		if effective == "" {
			delete(cm, "flow")
		} else {
			cm["flow"] = effective
		}
		rawClients[i] = cm
		changed = true
	}
	if !changed {
		return
	}
	settings["clients"] = rawClients
	if bs, err := json.MarshalIndent(settings, "", "  "); err == nil {
		inbound.Settings = string(bs)
	}
}

func parseStreamNetworkSecurity(streamSettingsJSON string) (network, security string) {
	network = "tcp"
	security = "none"
	streamSettingsJSON = strings.TrimSpace(streamSettingsJSON)
	if streamSettingsJSON == "" || streamSettingsJSON == "{}" {
		return network, security
	}
	var stream map[string]any
	if err := json.Unmarshal([]byte(streamSettingsJSON), &stream); err != nil || stream == nil {
		return network, security
	}
	if n, ok := stream["network"].(string); ok && strings.TrimSpace(n) != "" {
		network = strings.TrimSpace(n)
	}
	if s, ok := stream["security"].(string); ok && strings.TrimSpace(s) != "" {
		security = strings.TrimSpace(s)
	}
	return network, security
}

func vlessEncryptionFromSettings(inboundSettingsJSON string) string {
	inboundSettingsJSON = strings.TrimSpace(inboundSettingsJSON)
	if inboundSettingsJSON == "" {
		return ""
	}
	var root map[string]any
	if err := json.Unmarshal([]byte(inboundSettingsJSON), &root); err != nil || root == nil {
		return ""
	}
	e, _ := root["encryption"].(string)
	return strings.TrimSpace(e)
}
