package service

import (
	"testing"

	"github.com/konstpic/sharx-code/v2/database/model"
)

func TestVLESSXTLSFlowAllowed(t *testing.T) {
	settings := `{"clients":[{"flow":"xtls-rprx-vision"}],"encryption":"none"}`
	tcpTLS := `{"network":"tcp","security":"tls"}`
	xhttp := `{"network":"xhttp","security":"tls"}`
	ws := `{"network":"ws","security":"tls"}`

	if !VLESSXTLSFlowAllowed(model.VLESS, tcpTLS, settings) {
		t.Fatal("tcp+tls should allow flow")
	}
	if VLESSXTLSFlowAllowed(model.VLESS, xhttp, settings) {
		t.Fatal("xhttp must not allow xtls flow")
	}
	if VLESSXTLSFlowAllowed(model.VLESS, ws, settings) {
		t.Fatal("ws must not allow xtls flow")
	}
	if VLESSXTLSFlowAllowed(model.Trojan, tcpTLS, settings) {
		t.Fatal("trojan must not allow vless flow")
	}
}

func TestVLESSEffectiveFlow_clearsOnXhttp(t *testing.T) {
	settings := `{"clients":[{"flow":"xtls-rprx-vision"}]}`
	xhttp := `{"network":"xhttp","security":"reality"}`
	if got := VLESSEffectiveFlow(settings, xhttp, model.VLESS); got != "" {
		t.Fatalf("expected empty flow on xhttp, got %q", got)
	}
	tcp := `{"network":"tcp","security":"reality"}`
	if got := VLESSEffectiveFlow(settings, tcp, model.VLESS); got != "xtls-rprx-vision" {
		t.Fatalf("tcp+reality: got %q", got)
	}
}

func TestSanitizeVLESSFlowInInboundSettings_clearsOnXhttp(t *testing.T) {
	in := &model.Inbound{
		Protocol:       model.VLESS,
		Settings:       `{"clients":[{"flow":"xtls-rprx-vision"}]}`,
		StreamSettings: `{"network":"xhttp","security":"tls"}`,
	}
	SanitizeVLESSFlowInInboundSettings(in)
	if VLESSFlowFromInboundSettings(in.Settings) != "" {
		t.Fatalf("expected flow cleared in settings, got %q", in.Settings)
	}
}
