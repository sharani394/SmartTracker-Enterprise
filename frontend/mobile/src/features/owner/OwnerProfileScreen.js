
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiMessage } from '../../utils/feedback';

const initialProfile = {
  fullName: 'Organisation Owner',
  email: '',
  phone: '',
  jobTitle: '',
};

export default function OwnerProfileScreen({ navigation }) {
  const { user, updateProfile } = useAuth();
  const [profile, setProfile] = useState({ ...initialProfile, fullName: user?.fullName || '', email: user?.email || '', phone: user?.phone || '' });
  const [savedProfile, setSavedProfile] = useState({ ...initialProfile, fullName: user?.fullName || '', email: user?.email || '', phone: user?.phone || '' });
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const current = { ...initialProfile, fullName: user?.fullName || '', email: user?.email || '', phone: user?.phone || '' };
    setProfile(current); setSavedProfile(current);
  }, [user?.id, user?.fullName, user?.phone, user?.email]);

  const updateField = (field, value) => {
    setProfile((previous) => ({
      ...previous,
      [field]: value,
    }));
    setMessage('');
  };

  const handleSave = async () => {
    if (!profile.fullName.trim()) {
      setMessage('Please enter your full name.');
      return;
    }

    if (!profile.email.trim() || !/^\S+@\S+\.\S+$/.test(profile.email)) {
      setMessage('Please enter a valid email address.');
      return;
    }

    if (profile.phone.trim() && !/^[0-9+\-\s()]{10,15}$/.test(profile.phone)) {
      setMessage('Please enter a valid phone number.');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfile({ fullName: profile.fullName.trim(), phone: profile.phone.trim() });
      const saved = { ...profile, fullName: updated.fullName, phone: updated.phone };
      setProfile(saved); setSavedProfile(saved); setIsEditing(false); setMessage('Your profile changes have been saved.');
    } catch (error) { setMessage(apiMessage(error)); }
    finally { setSaving(false); }
  };

  const handleCancel = () => {
    setProfile({ ...savedProfile });
    setIsEditing(false);
    setMessage('');
  };

  const renderField = (label, field, placeholder, options = {}) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          (!isEditing || field === 'email' || field === 'jobTitle') && styles.readOnlyInput,
        ]}
        value={profile[field]}
        onChangeText={(value) => updateField(field, value)}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        editable={isEditing && field !== 'email' && field !== 'jobTitle'}
        keyboardType={options.keyboardType || 'default'}
        autoCapitalize={options.autoCapitalize || 'words'}
        autoCorrect={false}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Owner Profile</Text>
          <Text style={styles.headerSubtitle}>
            Manage your personal information and contact details.
          </Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.fullName.trim()
                ? profile.fullName.trim().charAt(0).toUpperCase()
                : 'O'}
            </Text>
          </View>

          <Text style={styles.profileName}>
            {profile.fullName || 'Your Name'}
          </Text>

          <Text style={styles.profileRole}>Organisation Owner</Text>

          <View style={styles.accountBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.accountBadgeText}>Owner Account</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <View>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              <Text style={styles.sectionDescription}>
                Your account details
              </Text>
            </View>

            {!isEditing && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  setIsEditing(true);
                  setMessage('');
                }}
              >
                <Text style={styles.editButtonText}>✎ Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {renderField('Full Name', 'fullName', 'Enter your full name')}

          {renderField(
            'Company Email',
            'email',
            'you@company.com',
            {
              keyboardType: 'email-address',
              autoCapitalize: 'none',
            }
          )}

          {renderField(
            'Phone Number',
            'phone',
            'Enter your phone number',
            { keyboardType: 'phone-pad' }
          )}

          {renderField(
            'Job Title',
            'jobTitle',
            'e.g. Founder / CEO'
          )}

          {isEditing && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                disabled={saving}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          )}

          {message !== '' && (
            <View style={[
              styles.messageBox,
              message.includes('saved')
                ? styles.successMessage
                : styles.errorMessage,
            ]}>
              <Text style={[
                styles.messageText,
                message.includes('saved')
                  ? styles.successText
                  : styles.errorText,
              ]}>
                {message}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Account Information</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account Type</Text>
            <Text style={styles.infoValue}>Organisation Owner</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account Status</Text>
            <Text style={styles.statusValue}>Active</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Access Level</Text>
            <Text style={styles.infoValue}>Owner</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          SmartTracker · Owner Profile
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FC',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 35,
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 18,
  },
  backText: {
    color: '#3157D5',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#17233D',
    fontSize: 24,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#7B8799',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 20,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EAEFF5',
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#EAF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#3157D5',
    fontSize: 30,
    fontWeight: '800',
  },
  profileName: {
    color: '#17233D',
    fontSize: 19,
    fontWeight: '800',
  },
  profileRole: {
    color: '#7B8799',
    fontSize: 12,
    marginTop: 5,
  },
  accountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F7EF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 13,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16845B',
    marginRight: 7,
  },
  accountBadgeText: {
    color: '#16845B',
    fontSize: 11,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 19,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EAEFF5',
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#17233D',
    fontSize: 16,
    fontWeight: '800',
  },
  sectionDescription: {
    color: '#8994A5',
    fontSize: 11,
    marginTop: 5,
  },
  editButton: {
    backgroundColor: '#EAF0FF',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 9,
  },
  editButtonText: {
    color: '#3157D5',
    fontSize: 12,
    fontWeight: '700',
  },
  fieldContainer: {
    marginBottom: 17,
  },
  label: {
    color: '#34415A',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#DDE4EF',
    borderRadius: 10,
    paddingHorizontal: 13,
    fontSize: 13,
    color: '#27344D',
    backgroundColor: '#FFFFFF',
  },
  readOnlyInput: {
    backgroundColor: '#F7F8FB',
    color: '#68758B',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
  },
  cancelButton: {
    flex: 1,
    height: 47,
    borderWidth: 1,
    borderColor: '#DDE4EF',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#526078',
    fontWeight: '700',
    fontSize: 13,
  },
  saveButton: {
    flex: 1.5,
    height: 47,
    backgroundColor: '#3157D5',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  messageBox: {
    padding: 12,
    borderRadius: 9,
    marginTop: 15,
  },
  successMessage: {
    backgroundColor: '#E8F7EF',
  },
  errorMessage: {
    backgroundColor: '#FCEAEA',
  },
  messageText: {
    fontSize: 12,
    fontWeight: '600',
  },
  successText: {
    color: '#16845B',
  },
  errorText: {
    color: '#C0392B',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 19,
    borderWidth: 1,
    borderColor: '#EAEFF5',
  },
  infoTitle: {
    color: '#17233D',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F6',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoLabel: {
    color: '#8994A5',
    fontSize: 12,
  },
  infoValue: {
    color: '#34415A',
    fontSize: 12,
    fontWeight: '700',
  },
  statusValue: {
    color: '#16845B',
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    color: '#A1AABA',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 22,
  },
});
