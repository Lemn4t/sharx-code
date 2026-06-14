package sub

import (
	"strings"

	"github.com/konstpic/sharx-code/v2/database/model"
)

func shallowCopyStringMap(m map[string]string) map[string]string {
	if m == nil {
		return nil
	}
	out := make(map[string]string, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}

func shallowCopyAnyMap(m map[string]any) map[string]any {
	if m == nil {
		return nil
	}
	out := make(map[string]any, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}

// realityOnlyKeys are Reality-specific query keys removed when overriding security to TLS or none.
var realityOnlyKeys = []string{"pbk", "sid", "spx"}

// allSecurityKeys are all TLS / Reality query keys removed when overriding security to none.
var allSecurityKeys = []string{"sni", "alpn", "fp", "pbk", "sid", "spx", "allowInsecure", "pcs", "flow", "ech"}

// applyHostSecurityOverride applies the Host.SubscriptionSecurity override to
// the security/TLS field in vless/trojan/ss-style query params, mirroring 3x-ui's
// External Proxy "Force TLS" semantics:
//   - ""    (inherit) → no-op; security/params from the inbound flow through
//   - "tls"           → security=tls, strip Reality-only keys (pbk, sid, spx);
//                       TLS-compatible keys (sni, alpn, fp, allowInsecure, ech, flow) stay
//   - "none"          → security=none, strip all TLS/Reality-related keys
func applyHostSecurityOverride(host *model.Host, params map[string]string) {
	if host == nil || params == nil {
		return
	}
	switch strings.ToLower(strings.TrimSpace(host.SubscriptionSecurity)) {
	case "tls":
		params["security"] = "tls"
		for _, k := range realityOnlyKeys {
			delete(params, k)
		}
	case "none":
		params["security"] = "none"
		for _, k := range allSecurityKeys {
			delete(params, k)
		}
	}
}

// applyHostOverridesToParams merges optional Host subscription_* fields into vless:// / trojan:// / ss:// query params.
func applyHostOverridesToParams(host *model.Host, streamNetwork string, params map[string]string) {
	if host == nil || params == nil {
		return
	}
	if sni := strings.TrimSpace(host.SubscriptionSNI); sni != "" {
		params["sni"] = sni
	}
	if alpn := strings.TrimSpace(host.SubscriptionAlpn); alpn != "" {
		params["alpn"] = alpn
	}
	if fp := strings.TrimSpace(host.SubscriptionFingerprint); fp != "" {
		params["fp"] = fp
	}
	if host.SubscriptionAllowInsecure != nil {
		if params["pcs"] != "" {
			// cert pin takes precedence over allowInsecure (Xray 26+)
		} else if *host.SubscriptionAllowInsecure {
			params["allowInsecure"] = "1"
		} else {
			delete(params, "allowInsecure")
		}
	}

	hh := strings.TrimSpace(host.SubscriptionHttpHost)
	pp := strings.TrimSpace(host.SubscriptionPath)
	switch streamNetwork {
	case "grpc":
		if hh != "" {
			params["authority"] = hh
		}
		if pp != "" {
			params["serviceName"] = pp
		}
	case "ws", "httpupgrade", "xhttp":
		if hh != "" {
			params["host"] = hh
		}
		if pp != "" {
			params["path"] = pp
		}
	case "tcp":
		if params["headerType"] == "http" {
			if hh != "" {
				params["host"] = hh
			}
			if pp != "" {
				params["path"] = pp
			}
		}
	}
	// Apply security override last so it can re-set or strip TLS keys regardless of other rules.
	applyHostSecurityOverride(host, params)
}

// applyHostOverridesToVmessBase merges Host subscription_* into VMess share JSON (before encoding).
func applyHostOverridesToVmessBase(host *model.Host, network string, baseObj map[string]any) {
	if host == nil || baseObj == nil {
		return
	}
	if sni := strings.TrimSpace(host.SubscriptionSNI); sni != "" {
		baseObj["sni"] = sni
	}
	if alpn := strings.TrimSpace(host.SubscriptionAlpn); alpn != "" {
		baseObj["alpn"] = alpn
	}
	if fp := strings.TrimSpace(host.SubscriptionFingerprint); fp != "" {
		baseObj["fp"] = fp
	}
	if host.SubscriptionAllowInsecure != nil {
		if _, hasPin := baseObj["pinnedPeerCertSha256"]; hasPin {
			// cert pin takes precedence over allowInsecure
		} else {
			baseObj["allowInsecure"] = *host.SubscriptionAllowInsecure
		}
	}

	hh := strings.TrimSpace(host.SubscriptionHttpHost)
	pp := strings.TrimSpace(host.SubscriptionPath)
	switch network {
	case "grpc":
		if hh != "" {
			baseObj["authority"] = hh
		}
		if pp != "" {
			baseObj["path"] = pp
		}
	case "ws", "httpupgrade", "xhttp":
		if hh != "" {
			baseObj["host"] = hh
		}
		if pp != "" {
			baseObj["path"] = pp
		}
	case "tcp":
		typeStr, _ := baseObj["type"].(string)
		if typeStr == "http" {
			if hh != "" {
				baseObj["host"] = hh
			}
			if pp != "" {
				baseObj["path"] = pp
			}
		}
	}
	// Security override for VMess share JSON, mirroring 3x-ui's Force TLS semantics.
	switch strings.ToLower(strings.TrimSpace(host.SubscriptionSecurity)) {
	case "tls":
		baseObj["tls"] = "tls"
	case "none":
		baseObj["tls"] = ""
		delete(baseObj, "sni")
		delete(baseObj, "alpn")
		delete(baseObj, "fp")
		delete(baseObj, "allowInsecure")
		delete(baseObj, "pinnedPeerCertSha256")
		delete(baseObj, "ech")
	}
}

// applyHostOverridesToHysteriaParams merges TLS-related Host overrides into hysteria:// query params (uses "insecure", not "allowInsecure").
func applyHostOverridesToHysteriaParams(host *model.Host, params map[string]string) {
	if host == nil || params == nil {
		return
	}
	if sni := strings.TrimSpace(host.SubscriptionSNI); sni != "" {
		params["sni"] = sni
	}
	if alpn := strings.TrimSpace(host.SubscriptionAlpn); alpn != "" {
		params["alpn"] = alpn
	}
	if fp := strings.TrimSpace(host.SubscriptionFingerprint); fp != "" {
		params["fp"] = fp
	}
	if host.SubscriptionAllowInsecure != nil {
		if params["pcs"] != "" {
			// cert pin takes precedence over insecure
		} else if *host.SubscriptionAllowInsecure {
			params["insecure"] = "1"
		} else {
			delete(params, "insecure")
		}
	}
	// Hysteria is intrinsically TLS-based; we don't translate "tls"/"none" here.
	// SubscriptionSecurity is intentionally ignored for hysteria/hysteria2 links.
}
