
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from 'react-native';

export default function OwnerAccessScreen({ navigation }) {
  const securityItems = [
    {
      title: 'Email Domain Verification',
      description: 'Allow registration only from approved company email domains.',
      enabled: true, status: 'Enforced by backend',
    },
    {
      title: 'Two-Factor Authentication',
      description: 'Require an additional verification step for account access.',
      enabled: false, status: 'Not available in the connected API',
    },
    {
      title: 'Strong Password Policy',
      description: 'Encourage strong passwords for organisation accounts.',
      enabled: true, status: 'Minimum password length enforced by backend',
    },
    {
      title: 'Login Alerts',
      description: 'Receive alerts about important sign-in activity.',
      enabled: false, status: 'Not available in the connected API',
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>‹ Back to Dashboard</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Security & Access</Text>
      <Text style={styles.subtitle}>
        Review organisation security settings and administrative access.
      </Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Security Overview</Text>
        <Text style={styles.statusDescription}>
          Review the current security configuration of your workspace.
        </Text>
        <View style={styles.statusRow}>
          <View style={styles.greenDot} />
          <Text style={styles.statusText}>Security settings available</Text>
        </View>
        <Text style={styles.smallNote}>
          The backend enforces company-domain validation and organisation permissions. Two-factor and login-alert preferences are not exposed by the current API.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Security Policies</Text>

      {securityItems.map((item) => (
        <View style={styles.settingCard} key={item.title}>
          <View style={styles.settingInfo}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDescription}>{item.description}</Text>
            <Text style={item.enabled ? styles.enabled : styles.disabled}>{item.status}</Text>
          </View>
          <Switch disabled
            value={item.enabled}
            trackColor={{ false: '#D8DEE9', true: '#AFC1FF' }}
            thumbColor={item.enabled ? '#3157D5' : '#FFFFFF'}
          />
        </View>
      ))}

      <Text style={styles.sectionTitle}>Administrative Access</Text>

      <View style={styles.settingCard}>
        <View style={styles.settingInfo}>
          <Text style={styles.cardTitle}>Primary Administrator</Text>
          <Text style={styles.cardDescription}>
            One Primary Admin is responsible for daily organisation operations.
          </Text>
          <Text style={styles.enabled}>Administrator account details are not exposed by the current API.</Text>
        </View>
      </View>

      <View style={styles.settingCard}>
        <View style={styles.settingInfo}>
          <Text style={styles.cardTitle}>Internal Administrators</Text>
          <Text style={styles.cardDescription}>
            Internal Admins receive delegated permissions from the Primary Admin.
          </Text>
          <Text style={styles.enabled}>See the Administrators section for accounts available through the organisation API.</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => navigation.navigate('OwnerSecurity')}
      >
        <Text style={styles.actionButtonText}>
          Open Owner Account Security →
        </Text>
      </TouchableOpacity>

      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Important</Text>
        <Text style={styles.cardDescription}>
          Organisation-wide security policies must be validated and enforced
          by the backend. Frontend settings alone cannot protect accounts or
          restrict access.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FC' },
  content: { padding: 18, paddingBottom: 35 },
  back: { color: '#3157D5', fontWeight: '700', marginBottom: 18 },
  title: { fontSize: 24, fontWeight: '800', color: '#17233D' },
  subtitle: { fontSize: 12, color: '#788499', marginTop: 6, marginBottom: 20 },
  statusCard: { backgroundColor: '#FFFFFF', padding: 17, borderRadius: 14, marginBottom: 22, borderWidth: 1, borderColor: '#EAEFF5' },
  statusTitle: { fontSize: 16, fontWeight: '800', color: '#17233D' },
  statusDescription: { color: '#8792A5', fontSize: 11, marginTop: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
  greenDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#16845B', marginRight: 8 },
  statusText: { color: '#16845B', fontSize: 12, fontWeight: '700' },
  smallNote: { color: '#929CAE', fontSize: 10, lineHeight: 16, marginTop: 12 },
  sectionTitle: { color: '#17233D', fontSize: 16, fontWeight: '800', marginBottom: 11, marginTop: 4 },
  settingCard: { backgroundColor: '#FFFFFF', borderRadius: 13, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#EAEFF5', flexDirection: 'row', alignItems: 'center' },
  settingInfo: { flex: 1, paddingRight: 10 },
  cardTitle: { color: '#27344D', fontSize: 13, fontWeight: '800' },
  cardDescription: { color: '#8792A5', fontSize: 11, lineHeight: 17, marginTop: 5 },
  enabled: { color: '#16845B', fontSize: 10, fontWeight: '800', marginTop: 8 },
  disabled: { color: '#C0392B', fontSize: 10, fontWeight: '800', marginTop: 8 },
  actionButton: { backgroundColor: '#3157D5', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  actionButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  infoCard: { backgroundColor: '#FFF8E8', padding: 15, borderRadius: 12, marginTop: 17 },
});
