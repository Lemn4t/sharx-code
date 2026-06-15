package service

import (
	"encoding/json"
	"testing"

	"github.com/konstpic/sharx-code/v2/database/model"
)

func TestBuildSettingsFromClientEntities_mixedNoClientsRequiresPassword(t *testing.T) {
	s := InboundService{}
	inbound := &model.Inbound{
		Protocol: model.Mixed,
		Settings: `{"auth":"noauth","udp":true}`,
	}
	settingsJSON, err := s.BuildSettingsFromClientEntities(inbound, nil)
	if err != nil {
		t.Fatal(err)
	}
	var settings map[string]any
	if err := json.Unmarshal([]byte(settingsJSON), &settings); err != nil {
		t.Fatal(err)
	}
	if settings["auth"] != "password" {
		t.Fatalf("auth = %v, want password", settings["auth"])
	}
	accounts, ok := settings["accounts"].([]any)
	if !ok {
		t.Fatalf("accounts type %T", settings["accounts"])
	}
	if len(accounts) != 0 {
		t.Fatalf("accounts len = %d, want 0", len(accounts))
	}
}

func TestBuildSettingsFromClientEntities_mixedWithClient(t *testing.T) {
	s := InboundService{}
	inbound := &model.Inbound{
		Protocol: model.Mixed,
		Settings: `{"auth":"password","udp":true}`,
	}
	entities := []*model.ClientEntity{
		{
			Name:     "user@example.com",
			Password: "secret",
			Enable:   true,
			Status:   "active",
		},
	}
	settingsJSON, err := s.BuildSettingsFromClientEntities(inbound, entities)
	if err != nil {
		t.Fatal(err)
	}
	var settings map[string]any
	if err := json.Unmarshal([]byte(settingsJSON), &settings); err != nil {
		t.Fatal(err)
	}
	if settings["auth"] != "password" {
		t.Fatalf("auth = %v, want password", settings["auth"])
	}
	accounts, ok := settings["accounts"].([]any)
	if !ok || len(accounts) != 1 {
		t.Fatalf("accounts = %#v", settings["accounts"])
	}
	acc, ok := accounts[0].(map[string]any)
	if !ok {
		t.Fatalf("account type %T", accounts[0])
	}
	if acc["user"] != "user" || acc["pass"] != "secret" {
		t.Fatalf("account = %#v", acc)
	}
}
