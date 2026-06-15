package service

import (
	"github.com/konstpic/sharx-code/v2/database/model"
)

// BuildWorkerSidecarPayloadsForNode builds Telemt and AmneziaWG payloads for worker apply-config.
// Both slices are non-nil (empty means stop all sidecars of that type on the worker).
func BuildWorkerSidecarPayloadsForNode(node *model.Node, ibs []*model.Inbound) ([]TelemtNodePayload, []AmneziaWGNodePayload, error) {
	telm, err := BuildTelemtPayloadsForNode(node, ibs)
	if err != nil {
		return nil, nil, err
	}
	if telm == nil {
		telm = []TelemtNodePayload{}
	}
	awg, err := BuildAmneziaWgPayloadsForNode(node, ibs)
	if err != nil {
		return nil, nil, err
	}
	if awg == nil {
		awg = []AmneziaWGNodePayload{}
	}
	return telm, awg, nil
}
