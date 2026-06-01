package job

import (
	"testing"

	"github.com/konstpic/sharx-code/v2/web/service"
	"github.com/konstpic/sharx-code/v2/xray"
)

func TestRankedSessionIPsFromResults_newestKeepsOldest(t *testing.T) {
	results := []service.ClientSessionNodeResult{{
		Sessions: []xray.OnlineIPSession{
			{IP: "1.1.1.1", LastSeen: 100},
			{IP: "2.2.2.2", LastSeen: 200},
			{IP: "3.3.3.3", LastSeen: 300},
		},
	}}
	ranked := rankedSessionIPsFromResults(results, "newest")
	if len(ranked) != 3 {
		t.Fatalf("expected 3 IPs, got %d", len(ranked))
	}
	if ranked[0].IP != "1.1.1.1" || ranked[2].IP != "3.3.3.3" {
		t.Fatalf("newest policy should sort ascending by LastSeen: %+v", ranked)
	}
	excess := ranked[2:]
	if len(excess) != 1 || excess[0].IP != "3.3.3.3" {
		t.Fatalf("expected newest IP as excess, got %+v", excess)
	}
}

func TestRankedSessionIPsFromResults_oldestKeepsNewest(t *testing.T) {
	results := []service.ClientSessionNodeResult{{
		Sessions: []xray.OnlineIPSession{
			{IP: "1.1.1.1", LastSeen: 100},
			{IP: "2.2.2.2", LastSeen: 200},
			{IP: "3.3.3.3", LastSeen: 300},
		},
	}}
	ranked := rankedSessionIPsFromResults(results, "oldest")
	if ranked[0].IP != "3.3.3.3" || ranked[2].IP != "1.1.1.1" {
		t.Fatalf("oldest policy should sort descending by LastSeen: %+v", ranked)
	}
	excess := ranked[2:]
	if len(excess) != 1 || excess[0].IP != "1.1.1.1" {
		t.Fatalf("expected oldest IP as excess, got %+v", excess)
	}
}
