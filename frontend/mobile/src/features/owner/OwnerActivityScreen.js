
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { auditService } from '../../services/auditService';
import { apiMessage } from '../../utils/feedback';

const filters = ['All', 'Administrator', 'Access', 'Organisation', 'Security'];

export default function OwnerActivityScreen({ navigation }) {
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [activityData, setActivityData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const categoriesByFilter = { Administrator: 'administrator', Access: 'access', Organisation: 'organisation', Security: 'security' };
    const category = selectedFilter === 'All' ? undefined : categoriesByFilter[selectedFilter];
    auditService.list({ limit: 100, category, q: search.trim() || undefined })
      .then((data) => { if (active) setActivityData((data.events || []).map((event) => ({
        id: event.id, title: event.action.replaceAll('_', ' ').toLowerCase(), description: `${event.targetType || 'Record'}${event.targetId ? ` · ${event.targetId}` : ''}`,
        category: event.targetType || 'Activity', person: event.actorName || event.actorRole || 'Organisation user', time: new Date(event.createdAt).toLocaleString(), icon: '📋',
      }))); })
      .catch((requestError) => { if (active) setError(apiMessage(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedFilter, search]);

  const filteredActivities = useMemo(() => {
    return activityData;
  }, [activityData]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>‹ Back to Dashboard</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Activity Logs</Text>
      <Text style={styles.subtitle}>
        Review important organisation-level changes and administrative events.
      </Text>

      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryNumber}>{activityData.length}</Text>
          <Text style={styles.summaryLabel}>Recent Activities</Text>
        </View>
        <View>
          <Text style={styles.summaryNumber}>{new Set(activityData.map((item) => item.category)).size}</Text>
          <Text style={styles.summaryLabel}>Categories</Text>
        </View>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search activity, person or event..."
        placeholderTextColor="#929CAE"
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContainer}
      >
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterButton,
              selectedFilter === filter && styles.filterActive,
            ]}
            onPress={() => setSelectedFilter(filter)}
          >
            <Text
              style={[
                styles.filterText,
                selectedFilter === filter && styles.filterTextActive,
              ]}
            >
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Recent Activity</Text>
      {loading ? <Text style={styles.emptyDescription}>Loading audit events…</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {filteredActivities.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No activities found</Text>
          <Text style={styles.emptyDescription}>
            Try a different search term or category.
          </Text>
        </View>
      ) : (
        filteredActivities.map((item) => (
          <View style={styles.activityCard} key={item.id}>
            <View style={styles.activityIcon}>
              <Text style={styles.iconText}>{item.icon}</Text>
            </View>

            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>{item.title}</Text>
              <Text style={styles.activityDescription}>
                {item.description}
              </Text>
              <Text style={styles.activityPerson}>
                Performed by: {item.person}
              </Text>
              <View style={styles.bottomRow}>
                <Text style={styles.category}>{item.category}</Text>
                <Text style={styles.time}>{item.time}</Text>
              </View>
            </View>
          </View>
        ))
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FC' },
  content: { padding: 18, paddingBottom: 35 },
  back: { color: '#3157D5', fontWeight: '700', marginBottom: 18 },
  title: { color: '#17233D', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#788499', fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 18 },
  summaryCard: { backgroundColor: '#FFFFFF', padding: 17, borderRadius: 13, flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15, borderWidth: 1, borderColor: '#EAEFF5' },
  summaryNumber: { color: '#3157D5', fontSize: 23, fontWeight: '800', textAlign: 'center' },
  summaryLabel: { color: '#8792A5', fontSize: 10, marginTop: 4 },
  searchInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAEFF5', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12, fontSize: 12, marginBottom: 13, color: '#27344D' },
  filterContainer: { gap: 8, paddingBottom: 17 },
  filterButton: { backgroundColor: '#FFFFFF', borderRadius: 9, paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: '#EAEFF5' },
  filterActive: { backgroundColor: '#3157D5', borderColor: '#3157D5' },
  filterText: { color: '#68758B', fontSize: 10, fontWeight: '700' },
  filterTextActive: { color: '#FFFFFF' },
  sectionTitle: { color: '#17233D', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  activityCard: { backgroundColor: '#FFFFFF', borderRadius: 13, padding: 14, marginBottom: 11, flexDirection: 'row', borderWidth: 1, borderColor: '#EAEFF5' },
  activityIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: '#EAF0FF', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  iconText: { fontSize: 17 },
  activityContent: { flex: 1 },
  activityTitle: { color: '#27344D', fontSize: 13, fontWeight: '800' },
  activityDescription: { color: '#8792A5', fontSize: 11, lineHeight: 16, marginTop: 5 },
  activityPerson: { color: '#526078', fontSize: 10, marginTop: 8 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 5 },
  category: { color: '#3157D5', backgroundColor: '#EAF0FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontSize: 9, fontWeight: '700' },
  time: { color: '#929CAE', fontSize: 9 },
  emptyCard: { backgroundColor: '#FFFFFF', padding: 22, borderRadius: 13, alignItems: 'center' },
  emptyTitle: { color: '#27344D', fontWeight: '800' },
  emptyDescription: { color: '#8792A5', fontSize: 11, marginTop: 6 },
  note: { color: '#929CAE', fontSize: 10, lineHeight: 16, marginTop: 10 },
  errorText: { color: '#B42318', marginVertical: 10 },
});
