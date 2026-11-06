import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { reportService } from '../../services/reportService';
import { apiMessage } from '../../utils/feedback';

const periods = { '7 Days': 7, '30 Days': 30, '90 Days': 90 };
export default function OwnerReportsScreen({ navigation }) {
  const [period, setPeriod] = useState('7 Days');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    const to = new Date(); const from = new Date(to.getTime() - periods[period] * 86400000);
    reportService.summary({ from: from.toISOString(), to: to.toISOString() })
      .then((data) => { if (current) setReport(data); })
      .catch((e) => { if (current) setError(apiMessage(e)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [period]);
  const counts = report?.statusCounts || {};
  const trendMax = Math.max(1, ...(report?.trends || []).map((x) => x.created));
  return <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back to Dashboard</Text></TouchableOpacity>
    <Text style={styles.title}>Reports & Analytics</Text><Text style={styles.subtitle}>Organisation ticket and support performance.</Text>
    {loading ? <Text style={styles.message}>Loading reports…</Text> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!loading && !error && report ? <>
      <View style={styles.statsGrid}>{[['Total Tickets', report.totals.tickets], ['Resolved', report.totals.resolved], ['Open', report.totals.open], ['Average Resolution (min)', report.resolution.averageMinutes ?? '—']].map(([label, value]) => <View style={styles.statCard} key={label}><Text style={styles.statNumber}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>)}</View>
      <View style={styles.panel}><Text style={styles.panelTitle}>Ticket Trends</Text><View style={styles.periodRow}>{Object.keys(periods).map((name) => <TouchableOpacity key={name} style={[styles.periodButton, period === name && styles.periodActive]} onPress={() => setPeriod(name)}><Text style={period === name ? styles.periodTextActive : styles.periodText}>{name}</Text></TouchableOpacity>)}</View>{report.trends.length ? report.trends.map((item) => <View style={styles.chartRow} key={item.period}><Text style={styles.chartLabel}>{item.period}</Text><View style={styles.barBackground}><View style={[styles.bar, { width: `${item.created / trendMax * 100}%` }]} /></View><Text style={styles.chartValue}>{item.created}</Text></View>) : <Text style={styles.message}>No ticket activity in this date range.</Text>}</View>
      <View style={styles.panel}><Text style={styles.panelTitle}>Tickets by Status</Text>{Object.entries(counts).map(([status, count]) => <Text style={styles.row} key={status}>{status.replaceAll('_', ' ')} · {count}</Text>)}</View>
      <View style={styles.panel}><Text style={styles.panelTitle}>Tickets by Priority</Text>{Object.entries(report.priorityCounts || {}).map(([priority, count]) => <Text style={styles.row} key={priority}>{priority} · {count}</Text>)}</View>
      <View style={styles.panel}><Text style={styles.panelTitle}>Departments</Text>{report.departmentCounts.map((item) => <Text style={styles.row} key={item.department}>{item.department} · {item.count}</Text>)}</View>
      <View style={styles.panel}><Text style={styles.panelTitle}>Agent Workload</Text>{report.agentPerformance.map((item) => <Text style={styles.row} key={item.agentId}>{item.name} · {item.assigned} assigned · {item.resolved} resolved</Text>)}</View>
    </> : null}
  </ScrollView>;
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#F5F7FB' }, content: { padding: 20 }, back: { color: '#3157D5', marginBottom: 18, fontWeight: '700' }, title: { fontSize: 26, fontWeight: '800', color: '#17233D' }, subtitle: { color: '#718096', marginTop: 6, marginBottom: 18 }, statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, statCard: { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16 }, statNumber: { fontSize: 24, color: '#3157D5', fontWeight: '800' }, statLabel: { color: '#718096', marginTop: 5 }, panel: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 14, marginTop: 14 }, panelTitle: { color: '#17233D', fontWeight: '800', fontSize: 16, marginBottom: 12 }, periodRow: { flexDirection: 'row', gap: 8, marginBottom: 14 }, periodButton: { padding: 8, borderRadius: 8, backgroundColor: '#F1F4FA' }, periodActive: { backgroundColor: '#3157D5' }, periodText: { color: '#526078', fontSize: 12 }, periodTextActive: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' }, chartRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 5 }, chartLabel: { width: 85, color: '#718096', fontSize: 11 }, barBackground: { flex: 1, height: 9, backgroundColor: '#EDF0F5', borderRadius: 6 }, bar: { height: 9, backgroundColor: '#3157D5', borderRadius: 6 }, chartValue: { width: 24, textAlign: 'right', color: '#526078' }, row: { color: '#526078', paddingVertical: 6 }, message: { color: '#718096', paddingVertical: 12 }, error: { color: '#B42318', paddingVertical: 12 } });
