package sub

import (
	"strings"
	"testing"

	"github.com/konstpic/sharx-code/v2/database/model"
)

func TestAppendSubscriptionLinks_wireguardSingleEntry(t *testing.T) {
	in := &model.Inbound{Protocol: model.WireGuard}
	link := "WireGuard (UDP)\n\n[Interface]\nPrivateKey = x\n\n[Peer]\nPublicKey = y\n"
	var dst []string
	dst = appendSubscriptionLinks(dst, in, link)
	if len(dst) != 1 {
		t.Fatalf("want 1 entry, got %d", len(dst))
	}
	if !strings.Contains(dst[0], "[Interface]") {
		t.Fatalf("expected full panel text, got %q", dst[0])
	}
}

func TestAppendSubscriptionLinks_vlessSplit(t *testing.T) {
	in := &model.Inbound{Protocol: model.VLESS}
	link := "vless://a\nvless://b"
	dst := appendSubscriptionLinks(nil, in, link)
	if len(dst) != 2 {
		t.Fatalf("want 2 entries, got %d: %v", len(dst), dst)
	}
}
