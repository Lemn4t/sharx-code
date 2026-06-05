package service

import (
	"testing"

	"github.com/konstpic/sharx-code/v2/database/model"
)

func TestInboundIDsEqual(t *testing.T) {
	if !inboundIDsEqual([]int{1, 2, 3}, []int{1, 2, 3}) {
		t.Fatal("same order should match")
	}
	if inboundIDsEqual([]int{1, 2}, []int{1, 2, 3}) {
		t.Fatal("different lengths should not match")
	}
	if inboundIDsEqual([]int{2, 1}, []int{1, 2}) {
		t.Fatal("different order should not match")
	}
	if !inboundIDsEqual([]int{1, 1, 2}, []int{1, 2}) {
		t.Fatal("deduped lists should match")
	}
}

func TestInboundAssignmentIDsSortOrder(t *testing.T) {
	mappings := []model.ClientInboundMapping{
		{InboundId: 10, SortOrder: 20},
		{InboundId: 5, SortOrder: 10},
	}
	got := inboundAssignmentIDs(mappings)
	want := []int{5, 10}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("got %v want %v", got, want)
	}
}
