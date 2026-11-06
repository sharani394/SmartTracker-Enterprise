
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useTickets } from '../../context/TicketContext';
import { apiMessage } from '../../utils/feedback';

export default function OwnerNotificationsScreen({ navigation }) {
  const { notifications, markNotificationsRead, setNotificationRead } = useTickets();
  const [error, setError] = React.useState('');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Back to Owner Settings</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.subtitle}>
        In-app updates delivered to your owner account.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Notifications</Text>
        <Text style={styles.description}>Notification channel preferences are not exposed by the backend.</Text>
        <TouchableOpacity style={styles.resetButton} onPress={async () => { try { await markNotificationsRead(); setError(''); } catch (requestError) { setError(apiMessage(requestError)); } }}><Text style={styles.resetText}>Mark all as read</Text></TouchableOpacity>
        {error ? <Text style={styles.message}>{error}</Text> : null}
        {notifications.length === 0 ? <Text style={styles.description}>No in-app notifications.</Text> : notifications.map((item) => <TouchableOpacity onPress={() => setNotificationRead(item.id, !item.read).catch((requestError) => setError(apiMessage(requestError)))} style={styles.item} key={item.id}><View style={styles.itemInfo}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.description}>{item.message}</Text><Text style={styles.description}>{new Date(item.createdAt).toLocaleString()} · {item.read ? 'Read' : 'Unread'}</Text></View></TouchableOpacity>)}
      </View>

      <Text style={styles.footer}>SmartTracker · Notification Centre</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FC' },
  content: { padding: 20, paddingBottom: 40 },
  back: { color: '#3157D5', fontWeight: '700', marginBottom: 22 },
  title: { fontSize: 24, fontWeight: '800', color: '#17233D' },
  subtitle: { color: '#7B8799', fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 20 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 15, padding: 17,
    marginBottom: 16, borderWidth: 1, borderColor: '#EAEFF5',
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#17233D' },
  description: { color: '#8490A3', fontSize: 11, lineHeight: 17, marginTop: 5 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#EAEFF5', marginTop: 12,
  },
  headerText: { color: '#68758B', fontSize: 10, fontWeight: '800' },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#EEF1F6',
  },
  itemInfo: { flex: 1, paddingRight: 8 },
  itemTitle: { color: '#27344D', fontSize: 12, fontWeight: '700' },
  switchColumn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', width: 112,
  },
  message: {
    backgroundColor: '#EAF0FF', color: '#3157D5',
    padding: 11, borderRadius: 8, fontSize: 12, marginTop: 15,
  },
  resetButton: {
    borderWidth: 1, borderColor: '#DCE3F0',
    padding: 13, borderRadius: 10, alignItems: 'center', marginTop: 16,
  },
  resetText: { color: '#3157D5', fontWeight: '700', fontSize: 12 },
  footer: { textAlign: 'center', color: '#A1AABA', fontSize: 10, marginTop: 15 },
});
