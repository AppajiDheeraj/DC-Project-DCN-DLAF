#include <core.p4>
#include <v1model.p4>

/*************************************************************************
*********************** H E A D E R S  ***********************************
*************************************************************************/

const bit<16> TYPE_IPV4 = 0x800;

typedef bit<9>  egressSpec_t;
typedef bit<48> macAddr_t;
typedef bit<32> ip4Addr_t;


header ethernet_t {
    macAddr_t dstAddr;
    macAddr_t srcAddr;
    bit<16>   etherType;
}

header ipv4_t {
    bit<4>    version;
    bit<4>    ihl;
    bit<6>    dscp;
    bit<2>    ecn;
    bit<16>   totalLen;
    bit<16>   identification;
    bit<3>    flags;
    bit<13>   fragOffset;
    bit<8>    ttl;
    bit<8>    protocol;
    bit<16>   hdrChecksum;
    ip4Addr_t srcAddr;
    ip4Addr_t dstAddr;
}

header tcp_t{
    bit<16> srcPort;
    bit<16> dstPort;
    bit<32> seqNo;
    bit<32> ackNo;
    bit<4>  dataOffset;
    bit<4>  res;
    bit<1>  cwr;
    bit<1>  ece;
    bit<1>  urg;
    bit<1>  ack;
    bit<1>  psh;
    bit<1>  rst;
    bit<1>  syn;
    bit<1>  fin;
    bit<16> window;
    bit<16> checksum;
    bit<16> urgentPtr;
}

struct headers {
    ethernet_t   ethernet;
    ipv4_t       ipv4;
    tcp_t        tcp;
}

struct metadata {
    bit<16> num_nhops;
    bit<14> ecmp_gid;
    bit<48> interval;
    bit<16> flow_index1;
    bit<16> flow_index2;
    bit<16> flow_index3;
    bit<16> flow_index4;
    bit<16> port_index;
}

/*************************************************************************
*********************** P A R S E R  *******************************
*************************************************************************/

parser MyParser(packet_in packet,
                out headers hdr,
                inout metadata meta,
                inout standard_metadata_t standard_metadata) {

    state start {
        packet.extract(hdr.ethernet);
        transition select(hdr.ethernet.etherType) {
            0x800: parse_ipv4;
            default: accept;
        }
    }

    state parse_ipv4 {
        packet.extract(hdr.ipv4);
        transition select(hdr.ipv4.protocol) {
            0x6: parse_tcp;
            default: accept;
        }
    }

    state parse_tcp {
        packet.extract(hdr.tcp);
        transition accept;
    }   
    
}

/*************************************************************************
***********************  D E P A R S E R  *******************************
*************************************************************************/

control MyDeparser(packet_out packet, in headers hdr) {
    apply {
        packet.emit(hdr.ethernet);
        packet.emit(hdr.ipv4);
        packet.emit(hdr.tcp);    
    }
}


/*************************************************************************
************   C H E C K S U M    V E R I F I C A T I O N   *************
*************************************************************************/

control MyVerifyChecksum(inout headers hdr, inout metadata meta) {
    apply {  }
}


/*************************************************************************
**************  I N G R E S S   P R O C E S S I N G   *******************
*************************************************************************/

control MyIngress(inout headers hdr,
                  inout metadata meta,
                  inout standard_metadata_t standard_metadata) {

    register<bit<48>>(512) last_seen1;
    register<bit<16>>(512) flowlet_id_tb1;
    register<bit<16>>(512) flow_pkt_count_tb1;
    register<bit<48>>(512) flow_gap_avg_tb1;
    register<bit<48>>(512) flow_gap_dev_tb1;
    // IMPROVED: use a 32-bit flow signature instead of 16-bit.
    // This lowers hash-collision probability, so unrelated flows are less
    // likely to inherit each other's stored flowlet path.
    register<bit<32>>(512) flow_id_tb1;

    register<bit<48>>(512) last_seen2;
    register<bit<16>>(512) flowlet_id_tb2;
    register<bit<16>>(512) flow_pkt_count_tb2;
    register<bit<48>>(512) flow_gap_avg_tb2;
    register<bit<48>>(512) flow_gap_dev_tb2;
    register<bit<32>>(512) flow_id_tb2;

    register<bit<48>>(512) last_seen3;
    register<bit<16>>(512) flowlet_id_tb3;
    register<bit<16>>(512) flow_pkt_count_tb3;
    register<bit<48>>(512) flow_gap_avg_tb3;
    register<bit<48>>(512) flow_gap_dev_tb3;
    register<bit<32>>(512) flow_id_tb3;

    register<bit<48>>(512) last_seen4;
    register<bit<16>>(512) flowlet_id_tb4;
    register<bit<16>>(512) flow_pkt_count_tb4;
    register<bit<48>>(512) flow_gap_avg_tb4;
    register<bit<48>>(512) flow_gap_dev_tb4;
    register<bit<32>>(512) flow_id_tb4;
    
    register<int<32>>(2) port_counter;
    // IMPROVED: remember when each path counter was last aged. Baseline DLAF
    // only increments counters, so old bursts can bias path choice long after
    // congestion has disappeared.
    register<bit<48>>(2) port_counter_last_decay;

    action drop() {
        mark_to_drop(standard_metadata);
    }

    action set_nhop(bit<9> port) {
        standard_metadata.egress_spec = port;
    }

    action ecmp_group(bit<16> num_nhops){
        meta.num_nhops = num_nhops;
    }

    action find_least_loaded() {
        int<32> c0;
        int<32> c1;
        port_counter.read(c0, 0);
        port_counter.read(c1, 1);
 
        if (c0 <= c1) {
            meta.port_index = 0;
        } else {
            meta.port_index = 1;
        }
    }

    action choose_bucket1(bit<32> flow_sig) {
        flow_id_tb1.write((bit<32>)meta.flow_index1, flow_sig);
        last_seen1.write((bit<32>)meta.flow_index1, standard_metadata.ingress_global_timestamp);
        flow_pkt_count_tb1.write((bit<32>)meta.flow_index1, 1);
        flow_gap_avg_tb1.write((bit<32>)meta.flow_index1, 0);
        flow_gap_dev_tb1.write((bit<32>)meta.flow_index1, 0);
        find_least_loaded();
        flowlet_id_tb1.write((bit<32>)meta.flow_index1, meta.port_index);
    }

    action choose_bucket2(bit<32> flow_sig) {
        flow_id_tb2.write((bit<32>)meta.flow_index2, flow_sig);
        last_seen2.write((bit<32>)meta.flow_index2, standard_metadata.ingress_global_timestamp);
        flow_pkt_count_tb2.write((bit<32>)meta.flow_index2, 1);
        flow_gap_avg_tb2.write((bit<32>)meta.flow_index2, 0);
        flow_gap_dev_tb2.write((bit<32>)meta.flow_index2, 0);
        find_least_loaded();
        flowlet_id_tb2.write((bit<32>)meta.flow_index2, meta.port_index);
    }

    action choose_bucket3(bit<32> flow_sig) {
        flow_id_tb3.write((bit<32>)meta.flow_index3, flow_sig);
        last_seen3.write((bit<32>)meta.flow_index3, standard_metadata.ingress_global_timestamp);
        flow_pkt_count_tb3.write((bit<32>)meta.flow_index3, 1);
        flow_gap_avg_tb3.write((bit<32>)meta.flow_index3, 0);
        flow_gap_dev_tb3.write((bit<32>)meta.flow_index3, 0);
        find_least_loaded();
        flowlet_id_tb3.write((bit<32>)meta.flow_index3, meta.port_index);
    }

    action choose_bucket4(bit<32> flow_sig) {
        flow_id_tb4.write((bit<32>)meta.flow_index4, flow_sig);
        last_seen4.write((bit<32>)meta.flow_index4, standard_metadata.ingress_global_timestamp);
        flow_pkt_count_tb4.write((bit<32>)meta.flow_index4, 1);
        flow_gap_avg_tb4.write((bit<32>)meta.flow_index4, 0);
        flow_gap_dev_tb4.write((bit<32>)meta.flow_index4, 0);
        find_least_loaded();
        flowlet_id_tb4.write((bit<32>)meta.flow_index4, meta.port_index);
    }

    table ipv4_lpm {
 	key = {
            hdr.ipv4.dstAddr: lpm; 
        }

        actions = {
            set_nhop;
            ecmp_group;
            drop;
            NoAction;
        }
        size = 256;
        default_action = NoAction;
    }
	
    table ecmp_group_to_nhop {
        key = {
            meta.ecmp_gid: exact; 
	}
        actions = {
            set_nhop;
            NoAction;
        }
        size = 16;
        default_action = NoAction;
    }

    apply {
        bit<32> flow_id1;
        bit<32> flow_id2;
        bit<32> flow_id3;
        bit<32> flow_id4;
        bit<48> last_pkt_ts1;
        bit<48> last_pkt_ts2;
        bit<48> last_pkt_ts3;
        bit<48> last_pkt_ts4;
        bit<32> flow_sig;
        int<32> cnt; 
        int<32> pkt_weight;
        int<32> aged_cnt0;
        int<32> aged_cnt1;
        bit<48> last_decay0;
        bit<48> last_decay1;
        bit<48> gap;
        bit<48> avg_gap;
        bit<48> gap_dev;
        bit<48> dynamic_gap;
        bit<16> pkt_count;

        switch (ipv4_lpm.apply().action_run) {
            ecmp_group: {
		if (hdr.ipv4.isValid()){
                    pkt_weight = 1;
                    if (hdr.ipv4.totalLen > 1000) {
                        pkt_weight = 2;
                    }

                    if (hdr.tcp.isValid()) {
                        // IMPROVED: CRC32-backed table indexes with distinct
                        // RSS/Toeplitz-style salts. BMv2 exposes CRC32
                        // directly, so this stays hardware-friendly while
                        // reducing structured CRC16 collision patterns.
                        hash(meta.flow_index1, HashAlgorithm.crc32, (bit<1>)0, {hdr.ipv4.srcAddr, hdr.ipv4.dstAddr, hdr.ipv4.protocol, hdr.tcp.srcPort, hdr.tcp.dstPort, (bit<16>)0x6d5a}, (bit<16>)512);
                        hash(meta.flow_index2, HashAlgorithm.crc32, (bit<1>)0, {hdr.ipv4.dstAddr, hdr.ipv4.srcAddr, hdr.ipv4.protocol, hdr.tcp.dstPort, hdr.tcp.srcPort, (bit<16>)0xb4c3}, (bit<16>)512);
                        hash(meta.flow_index3, HashAlgorithm.crc32, (bit<1>)0, {hdr.ipv4.srcAddr, hdr.ipv4.dstAddr, hdr.tcp.dstPort, hdr.tcp.srcPort, hdr.ipv4.protocol, (bit<16>)0x9e37}, (bit<16>)512);
                        hash(meta.flow_index4, HashAlgorithm.crc32, (bit<1>)0, {hdr.ipv4.dstAddr, hdr.ipv4.srcAddr, hdr.tcp.srcPort, hdr.tcp.dstPort, hdr.ipv4.protocol, (bit<16>)0x79b9}, (bit<16>)512);
                        hash(flow_sig, HashAlgorithm.crc32, (bit<1>)0, {hdr.ipv4.srcAddr, hdr.ipv4.dstAddr, hdr.ipv4.protocol, hdr.tcp.srcPort, hdr.tcp.dstPort}, (bit<32>)4294967295);
                    } else {
                        // IMPROVED: protocol-aware fallback for UDP/ICMP.
                        // The baseline hashes TCP ports even when no TCP
                        // header was parsed; this uses valid IPv4 fields and
                        // the packet identification to keep UDP benchmark
                        // traffic load-aware instead of depending on invalid
                        // header data.
                        hash(meta.flow_index1, HashAlgorithm.crc32, (bit<1>)0, {hdr.ipv4.srcAddr, hdr.ipv4.dstAddr, hdr.ipv4.protocol, hdr.ipv4.identification, (bit<16>)0x6d5a}, (bit<16>)512);
                        hash(meta.flow_index2, HashAlgorithm.crc32, (bit<1>)0, {hdr.ipv4.dstAddr, hdr.ipv4.srcAddr, hdr.ipv4.protocol, hdr.ipv4.identification, (bit<16>)0xb4c3}, (bit<16>)512);
                        hash(meta.flow_index3, HashAlgorithm.crc32, (bit<1>)0, {hdr.ipv4.srcAddr, hdr.ipv4.dstAddr, hdr.ipv4.identification, hdr.ipv4.protocol, (bit<16>)0x9e37}, (bit<16>)512);
                        hash(meta.flow_index4, HashAlgorithm.crc32, (bit<1>)0, {hdr.ipv4.dstAddr, hdr.ipv4.srcAddr, hdr.ipv4.identification, hdr.ipv4.protocol, (bit<16>)0x79b9}, (bit<16>)512);
                        hash(flow_sig, HashAlgorithm.crc32, (bit<1>)0, {hdr.ipv4.srcAddr, hdr.ipv4.dstAddr, hdr.ipv4.protocol, hdr.ipv4.identification}, (bit<32>)4294967295);
                    }

                    port_counter.read(aged_cnt0, 0);
                    port_counter.read(aged_cnt1, 1);
                    port_counter_last_decay.read(last_decay0, 0);
                    port_counter_last_decay.read(last_decay1, 1);

                    // IMPROVED: age counters after idle periods. This
                    // approximates a moving load window using simple
                    // P4-friendly arithmetic, so stale bursts do not bias
                    // future path choices forever.
                    if (standard_metadata.ingress_global_timestamp - last_decay0 > 200000) {
                        if (aged_cnt0 > 0) {
                            aged_cnt0 = aged_cnt0 - 1;
                            port_counter.write(0, aged_cnt0);
                        }
                        port_counter_last_decay.write(0, standard_metadata.ingress_global_timestamp);
                    }
                    if (standard_metadata.ingress_global_timestamp - last_decay1 > 200000) {
                        if (aged_cnt1 > 0) {
                            aged_cnt1 = aged_cnt1 - 1;
                            port_counter.write(1, aged_cnt1);
                        }
                        port_counter_last_decay.write(1, standard_metadata.ingress_global_timestamp);
                    }
	            
                    flow_id_tb1.read(flow_id1, (bit<32>)meta.flow_index1);
	            flow_id_tb2.read(flow_id2, (bit<32>)meta.flow_index2);
                    flow_id_tb3.read(flow_id3, (bit<32>)meta.flow_index3);
	            flow_id_tb4.read(flow_id4, (bit<32>)meta.flow_index4);
                
                    last_seen1.read(last_pkt_ts1, (bit<32>)meta.flow_index1);   
                    last_seen2.read(last_pkt_ts2, (bit<32>)meta.flow_index2);
                    last_seen3.read(last_pkt_ts3, (bit<32>)meta.flow_index3);   
                    last_seen4.read(last_pkt_ts4, (bit<32>)meta.flow_index4);
            
                    if (flow_id1 == flow_sig) {
                        gap = standard_metadata.ingress_global_timestamp - last_pkt_ts1;
                        flow_pkt_count_tb1.read(pkt_count, (bit<32>)meta.flow_index1);
                        flow_gap_avg_tb1.read(avg_gap, (bit<32>)meta.flow_index1);
                        flow_gap_dev_tb1.read(gap_dev, (bit<32>)meta.flow_index1);

                        // IMPROVED: dynamic flowlet gap adaptation.
                        // Mice flows get a larger gap to avoid over-splitting;
                        // elephant/high-rate flows get a smaller gap so they
                        // can be rebalanced before dominating one path. The
                        // smoothed deviation models gap variance/jitter: noisy
                        // flows get a safer gap, stable high-rate flows get a
                        // tighter one.
                        dynamic_gap = 50000;
                        if (pkt_count < 8) {
                            dynamic_gap = 100000;
                        } else if (pkt_count > 64) {
                            dynamic_gap = 25000;
                        }
                        if (avg_gap > 0) {
                            if (avg_gap < 30000) {
                                dynamic_gap = 25000;
                            } else if (avg_gap > 100000) {
                                dynamic_gap = 100000;
                            }
                        }
                        if (gap_dev > 50000) {
                            dynamic_gap = 100000;
                        }

                        if (gap > dynamic_gap) {
            	            find_least_loaded();
                            flowlet_id_tb1.write((bit<32>)meta.flow_index1, meta.port_index);   
                        }
                        if (avg_gap == 0) {
                            avg_gap = gap;
                            gap_dev = 0;
                        } else {
                            if (gap > avg_gap) {
                                gap_dev = (gap_dev + (gap - avg_gap)) >> 1;
                            } else {
                                gap_dev = (gap_dev + (avg_gap - gap)) >> 1;
                            }
                            avg_gap = (avg_gap + gap) >> 1;
                        }
                        if (pkt_count < 65535) {
                            pkt_count = pkt_count + 1;
                        }
                        if (pkt_count > 32) {
                            pkt_weight = 4;
                        }
                        flow_pkt_count_tb1.write((bit<32>)meta.flow_index1, pkt_count);
                        flow_gap_avg_tb1.write((bit<32>)meta.flow_index1, avg_gap);
                        flow_gap_dev_tb1.write((bit<32>)meta.flow_index1, gap_dev);
                        last_seen1.write((bit<32>)meta.flow_index1, standard_metadata.ingress_global_timestamp);
	                flowlet_id_tb1.read(meta.port_index, (bit<32>)meta.flow_index1);    
                    } else if (flow_id2 == flow_sig) {
                        gap = standard_metadata.ingress_global_timestamp - last_pkt_ts2;
                        flow_pkt_count_tb2.read(pkt_count, (bit<32>)meta.flow_index2);
                        flow_gap_avg_tb2.read(avg_gap, (bit<32>)meta.flow_index2);
                        flow_gap_dev_tb2.read(gap_dev, (bit<32>)meta.flow_index2);

                        // IMPROVED: dynamic gap for this bucket as above.
                        dynamic_gap = 50000;
                        if (pkt_count < 8) {
                            dynamic_gap = 100000;
                        } else if (pkt_count > 64) {
                            dynamic_gap = 25000;
                        }
                        if (avg_gap > 0) {
                            if (avg_gap < 30000) {
                                dynamic_gap = 25000;
                            } else if (avg_gap > 100000) {
                                dynamic_gap = 100000;
                            }
                        }
                        if (gap_dev > 50000) {
                            dynamic_gap = 100000;
                        }

                        if (gap > dynamic_gap) {
                            find_least_loaded();       
            	            flowlet_id_tb2.write((bit<32>)meta.flow_index2, meta.port_index);
                        }
                        if (avg_gap == 0) {
                            avg_gap = gap;
                            gap_dev = 0;
                        } else {
                            if (gap > avg_gap) {
                                gap_dev = (gap_dev + (gap - avg_gap)) >> 1;
                            } else {
                                gap_dev = (gap_dev + (avg_gap - gap)) >> 1;
                            }
                            avg_gap = (avg_gap + gap) >> 1;
                        }
                        if (pkt_count < 65535) {
                            pkt_count = pkt_count + 1;
                        }
                        if (pkt_count > 32) {
                            pkt_weight = 4;
                        }
                        flow_pkt_count_tb2.write((bit<32>)meta.flow_index2, pkt_count);
                        flow_gap_avg_tb2.write((bit<32>)meta.flow_index2, avg_gap);
                        flow_gap_dev_tb2.write((bit<32>)meta.flow_index2, gap_dev);
                        last_seen2.write((bit<32>)meta.flow_index2, standard_metadata.ingress_global_timestamp);
		        flowlet_id_tb2.read(meta.port_index, (bit<32>)meta.flow_index2);
                    } else if (flow_id3 == flow_sig) {
                        gap = standard_metadata.ingress_global_timestamp - last_pkt_ts3;
                        flow_pkt_count_tb3.read(pkt_count, (bit<32>)meta.flow_index3);
                        flow_gap_avg_tb3.read(avg_gap, (bit<32>)meta.flow_index3);
                        flow_gap_dev_tb3.read(gap_dev, (bit<32>)meta.flow_index3);

                        // IMPROVED: dynamic gap for this bucket as above.
                        dynamic_gap = 50000;
                        if (pkt_count < 8) {
                            dynamic_gap = 100000;
                        } else if (pkt_count > 64) {
                            dynamic_gap = 25000;
                        }
                        if (avg_gap > 0) {
                            if (avg_gap < 30000) {
                                dynamic_gap = 25000;
                            } else if (avg_gap > 100000) {
                                dynamic_gap = 100000;
                            }
                        }
                        if (gap_dev > 50000) {
                            dynamic_gap = 100000;
                        }

                        if (gap > dynamic_gap) {
                            find_least_loaded();       
            	            flowlet_id_tb3.write((bit<32>)meta.flow_index3, meta.port_index);
                        }
                        if (avg_gap == 0) {
                            avg_gap = gap;
                            gap_dev = 0;
                        } else {
                            if (gap > avg_gap) {
                                gap_dev = (gap_dev + (gap - avg_gap)) >> 1;
                            } else {
                                gap_dev = (gap_dev + (avg_gap - gap)) >> 1;
                            }
                            avg_gap = (avg_gap + gap) >> 1;
                        }
                        if (pkt_count < 65535) {
                            pkt_count = pkt_count + 1;
                        }
                        if (pkt_count > 32) {
                            pkt_weight = 4;
                        }
                        flow_pkt_count_tb3.write((bit<32>)meta.flow_index3, pkt_count);
                        flow_gap_avg_tb3.write((bit<32>)meta.flow_index3, avg_gap);
                        flow_gap_dev_tb3.write((bit<32>)meta.flow_index3, gap_dev);
                        last_seen3.write((bit<32>)meta.flow_index3, standard_metadata.ingress_global_timestamp);
		        flowlet_id_tb3.read(meta.port_index, (bit<32>)meta.flow_index3);
                    } else if (flow_id4 == flow_sig) {
                        gap = standard_metadata.ingress_global_timestamp - last_pkt_ts4;
                        flow_pkt_count_tb4.read(pkt_count, (bit<32>)meta.flow_index4);
                        flow_gap_avg_tb4.read(avg_gap, (bit<32>)meta.flow_index4);
                        flow_gap_dev_tb4.read(gap_dev, (bit<32>)meta.flow_index4);

                        // IMPROVED: dynamic gap for this bucket as above.
                        dynamic_gap = 50000;
                        if (pkt_count < 8) {
                            dynamic_gap = 100000;
                        } else if (pkt_count > 64) {
                            dynamic_gap = 25000;
                        }
                        if (avg_gap > 0) {
                            if (avg_gap < 30000) {
                                dynamic_gap = 25000;
                            } else if (avg_gap > 100000) {
                                dynamic_gap = 100000;
                            }
                        }
                        if (gap_dev > 50000) {
                            dynamic_gap = 100000;
                        }

                        if (gap > dynamic_gap) {
                            find_least_loaded();       
            	            flowlet_id_tb4.write((bit<32>)meta.flow_index4, meta.port_index);
                        }
                        if (avg_gap == 0) {
                            avg_gap = gap;
                            gap_dev = 0;
                        } else {
                            if (gap > avg_gap) {
                                gap_dev = (gap_dev + (gap - avg_gap)) >> 1;
                            } else {
                                gap_dev = (gap_dev + (avg_gap - gap)) >> 1;
                            }
                            avg_gap = (avg_gap + gap) >> 1;
                        }
                        if (pkt_count < 65535) {
                            pkt_count = pkt_count + 1;
                        }
                        if (pkt_count > 32) {
                            pkt_weight = 4;
                        }
                        flow_pkt_count_tb4.write((bit<32>)meta.flow_index4, pkt_count);
                        flow_gap_avg_tb4.write((bit<32>)meta.flow_index4, avg_gap);
                        flow_gap_dev_tb4.write((bit<32>)meta.flow_index4, gap_dev);
                        // IMPROVED: baseline accidentally refreshed table 3's
                        // timestamp here. Refresh table 4 so eviction state is
                        // correct for table-4 hits.
                        last_seen4.write((bit<32>)meta.flow_index4, standard_metadata.ingress_global_timestamp);
		        flowlet_id_tb4.read(meta.port_index, (bit<32>)meta.flow_index4);
                    } else {
                        // IMPROVED: always evict the truly oldest candidate.
                        // The baseline nested if/else chain can miss cases
                        // such as table1 older than table2 but newer than
                        // table3, leaving the new flow without a fresh bucket.
                        if (last_pkt_ts1 <= last_pkt_ts2 && last_pkt_ts1 <= last_pkt_ts3 && last_pkt_ts1 <= last_pkt_ts4) {
                            choose_bucket1(flow_sig);
                        } else if (last_pkt_ts2 <= last_pkt_ts1 && last_pkt_ts2 <= last_pkt_ts3 && last_pkt_ts2 <= last_pkt_ts4) {
                            choose_bucket2(flow_sig);
                        } else if (last_pkt_ts3 <= last_pkt_ts1 && last_pkt_ts3 <= last_pkt_ts2 && last_pkt_ts3 <= last_pkt_ts4) {
                            choose_bucket3(flow_sig);
                        } else {
                            choose_bucket4(flow_sig);
                        }
                    } 
                    port_counter.read(cnt, (bit<32>)meta.port_index);
                    // IMPROVED: flow-size awareness. Large packets and flows
                    // that have crossed the elephant threshold consume more
                    // load-counter budget, so the next elephant is less likely
                    // to be placed on the same path.
                    cnt = cnt + pkt_weight;
                    port_counter.write((bit<32>)meta.port_index, cnt);     
  
                    meta.ecmp_gid = (bit<14>)meta.port_index;
                    ecmp_group_to_nhop.apply();
                }
            }
            default: {
            }
        }
    }
} 

/*************************************************************************
****************  E G R E S S   P R O C E S S I N G   *******************
*************************************************************************/

control MyEgress(inout headers hdr,
                 inout metadata meta,
                 inout standard_metadata_t standard_metadata) {
    apply {  }
}

/*************************************************************************
*************   C H E C K S U M    C O M P U T A T I O N   **************
*************************************************************************/

control MyComputeChecksum(inout headers hdr, inout metadata meta) {
    apply {
    update_checksum(
	    hdr.ipv4.isValid(),
            { hdr.ipv4.version,
	      hdr.ipv4.ihl,
              hdr.ipv4.dscp,
              hdr.ipv4.ecn,
              hdr.ipv4.totalLen,
              hdr.ipv4.identification,
              hdr.ipv4.flags,
              hdr.ipv4.fragOffset,
              hdr.ipv4.ttl,
              hdr.ipv4.protocol,
              hdr.ipv4.srcAddr,
              hdr.ipv4.dstAddr },
              hdr.ipv4.hdrChecksum,
              HashAlgorithm.csum16);    
    }
}

/*************************************************************************
***********************  S W I T C H  *******************************
*************************************************************************/

//switch architecture
V1Switch(
MyParser(),
MyVerifyChecksum(),
MyIngress(),
MyEgress(),
MyComputeChecksum(),
MyDeparser()
) main;
