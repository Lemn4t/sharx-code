package amneziawg

import (
	"reflect"
	"testing"
)

func TestBuildIptablesArgs(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name    string
		table   string
		command string
		args    []string
		want    []string
	}{
		{
			name:    "filter forward append",
			table:   "",
			command: "-A",
			args:    []string{"FORWARD", "-i", "awg1", "-j", "ACCEPT"},
			want:    []string{"-A", "FORWARD", "-i", "awg1", "-j", "ACCEPT"},
		},
		{
			name:    "nat masquerade check",
			table:   "nat",
			command: "-C",
			args:    []string{"POSTROUTING", "-s", "10.8.0.0/24", "-j", "MASQUERADE"},
			want:    []string{"-t", "nat", "-C", "POSTROUTING", "-s", "10.8.0.0/24", "-j", "MASQUERADE"},
		},
		{
			name:    "nat masquerade append",
			table:   "nat",
			command: "-A",
			args:    []string{"POSTROUTING", "-s", "10.8.0.0/24", "-j", "MASQUERADE"},
			want:    []string{"-t", "nat", "-A", "POSTROUTING", "-s", "10.8.0.0/24", "-j", "MASQUERADE"},
		},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := buildIptablesArgs(tc.table, tc.command, tc.args...)
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("buildIptablesArgs() = %v, want %v", got, tc.want)
			}
		})
	}
}
