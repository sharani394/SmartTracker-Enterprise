import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiMessage, showMessage } from '../../utils/feedback';

export default function InternalAdminInvitationScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { acceptInternalAdminInvitation } = useAuth();

  const submit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^\d{6}$/.test(code.trim()) || password.length < 8 || password !== confirmPassword) {
      showMessage('Check your details', 'Enter your invited company email, six-digit code, and matching passwords of at least eight characters.');
      return;
    }
    setLoading(true);
    try {
      const result = await acceptInternalAdminInvitation({ email: cleanEmail, code: code.trim(), password });
      showMessage('Invitation accepted', result.message || 'You can now sign in.');
      navigation.replace('AdminLogin');
    } catch (error) {
      showMessage('Invitation could not be accepted', apiMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <View style={styles.card}>
          <Text style={styles.brand}>SmartTracker</Text>
          <Text style={styles.title}>Accept Internal Admin Invitation</Text>
          <Text style={styles.subtitle}>Use the email and one-time code from your organisation's invitation.</Text>
          {[
            ['Company email', email, setEmail, 'email-address'],
            ['Invitation code', code, (value) => setCode(value.replace(/\D/g, '').slice(0, 6)), 'number-pad'],
            ['Create password', password, setPassword, 'default'],
            ['Confirm password', confirmPassword, setConfirmPassword, 'default'],
          ].map(([label, value, setter, keyboardType]) => (
            <View key={label} style={styles.field}>
              <Text style={styles.label}>{label}</Text>
              <TextInput style={styles.input} value={value} onChangeText={setter} placeholder={label} keyboardType={keyboardType} autoCapitalize="none" secureTextEntry={label.includes('password')} maxLength={label.includes('code') ? 6 : undefined} />
            </View>
          ))}
          <TouchableOpacity style={[styles.button, loading && styles.disabled]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Accept Invitation</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FC' }, content: { flexGrow: 1, padding: 22, justifyContent: 'center' },
  back: { color: '#3157D5', fontWeight: '700', marginBottom: 18 }, card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#EAEFF5' },
  brand: { color: '#3157D5', fontWeight: '800' }, title: { color: '#17233D', fontSize: 22, fontWeight: '800', marginTop: 18 }, subtitle: { color: '#788499', fontSize: 12, lineHeight: 19, marginVertical: 10 },
  field: { marginTop: 12 }, label: { color: '#526078', fontSize: 12, fontWeight: '700', marginBottom: 6 }, input: { borderWidth: 1, borderColor: '#DCE3EE', borderRadius: 9, padding: 12 },
  button: { backgroundColor: '#16845B', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20 }, disabled: { opacity: 0.65 }, buttonText: { color: '#fff', fontWeight: '700' },
});
