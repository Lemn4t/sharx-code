package sub

import "testing"

func TestContentTypeForClient_HappUsesJSON(t *testing.T) {
	got := ContentTypeForClient(UAHapp, FormatEncrypted)
	want := "application/json; charset=utf-8"
	if got != want {
		t.Fatalf("Happ Content-Type = %q, want %q", got, want)
	}
}

func TestContentTypeForClient_V2RayTunKeepsPlain(t *testing.T) {
	got := ContentTypeForClient(UAV2RayTun, FormatEncrypted)
	want := "text/plain; charset=utf-8"
	if got != want {
		t.Fatalf("v2rayTun Content-Type = %q, want %q", got, want)
	}
}

func TestContentTypeForClient_UnknownBase64Plain(t *testing.T) {
	got := ContentTypeForClient(UAUnknown, FormatBase64)
	want := "text/plain; charset=utf-8"
	if got != want {
		t.Fatalf("unknown base64 Content-Type = %q, want %q", got, want)
	}
}
