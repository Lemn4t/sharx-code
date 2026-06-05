package service

import "testing"

func TestResponseHeaderDelivery(t *testing.T) {
	if !ResponseHeaderDeliversHTTP(ResponseHeaderDeliveryHeader) {
		t.Fatal("header delivery should send HTTP")
	}
	if ResponseHeaderDeliversBody(ResponseHeaderDeliveryHeader) {
		t.Fatal("header delivery should not send body")
	}
	if !ResponseHeaderDeliversHTTP(ResponseHeaderDeliveryBoth) {
		t.Fatal("both delivery should send HTTP")
	}
	if !ResponseHeaderDeliversBody(ResponseHeaderDeliveryBoth) {
		t.Fatal("both delivery should send body")
	}
	if ResponseHeaderDeliversHTTP(ResponseHeaderDeliveryNone) {
		t.Fatal("none delivery should not send HTTP")
	}
	if ResponseHeaderDeliversBody(ResponseHeaderDeliveryNone) {
		t.Fatal("none delivery should not send body")
	}
	if NormalizeResponseHeaderDelivery("") != ResponseHeaderDeliveryHeader {
		t.Fatal("empty delivery should default to header")
	}
}
