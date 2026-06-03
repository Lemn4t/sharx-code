package service

import (
	"testing"

	"github.com/konstpic/sharx-code/v2/database/model"
)

func TestValidateInboundTag_format(t *testing.T) {
	if err := validateInboundTagFormat("inbound-443"); err != nil {
		t.Fatalf("valid tag: %v", err)
	}
	if err := validateInboundTagFormat("my-inbound.v2"); err != nil {
		t.Fatalf("valid dotted tag: %v", err)
	}
	if err := validateInboundTagFormat("api"); err == nil {
		t.Fatal("api must be reserved")
	}
	if err := validateInboundTagFormat("-bad"); err == nil {
		t.Fatal("must not start with dash")
	}
}

func TestAssignInboundTag_auto(t *testing.T) {
	s := InboundService{}
	in := &model.Inbound{Port: 8443, Listen: ""}
	userProvided, err := s.AssignInboundTag(in, false)
	if err != nil {
		t.Fatal(err)
	}
	if userProvided {
		t.Fatal("expected auto tag")
	}
	if in.Tag != "inbound-8443" {
		t.Fatalf("got %q", in.Tag)
	}
}

func TestAssignInboundTag_user(t *testing.T) {
	s := InboundService{}
	in := &model.Inbound{Port: 443, Tag: "custom-edge"}
	userProvided, err := s.AssignInboundTag(in, false)
	if err != nil {
		t.Fatal(err)
	}
	if !userProvided || in.Tag != "custom-edge" {
		t.Fatalf("userProvided=%v tag=%q", userProvided, in.Tag)
	}
}
