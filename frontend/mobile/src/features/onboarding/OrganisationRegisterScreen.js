
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiMessage, showMessage } from '../../utils/feedback';

export default function OrganisationRegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    organisationName: '',
    domain: '',
    ownerName: '',
    email: '',
    phone: '',
    industry: '',
    country: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { registerOrganisation } = useAuth();

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const validateForm = () => {
    const requiredFields = [
      'organisationName',
      'domain',
      'ownerName',
      'email',
      'phone',
      'industry',
      'country',
      'password',
      'confirmPassword',
    ];

    for (const field of requiredFields) {
      if (!form[field].trim()) {
        showMessage('Missing information', 'Please fill in all fields.');
        return false;
      }
    }

    const domain = form.domain.trim().toLowerCase()
      .replace(/^@/, '')
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');

    const email = form.email.trim().toLowerCase();

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      showMessage('Invalid email', 'Please enter a valid company email.');
      return false;
    }

    if (!email.endsWith(`@${domain}`)) {
      showMessage('Domain mismatch', `Your email must belong to the registered company domain: ${domain}`);
      return false;
    }

    if (form.password.length < 8) {
      showMessage('Weak password', 'Password must contain at least 8 characters.');
      return false;
    }

    if (form.password !== form.confirmPassword) {
      showMessage('Password mismatch', 'Your passwords do not match.');
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const domain = form.domain.trim().toLowerCase().replace(/^@/, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
      const result = await registerOrganisation({
        organisationName: form.organisationName.trim(), domain, ownerName: form.ownerName.trim(),
        email: form.email.trim().toLowerCase(), phone: form.phone.trim(), industry: form.industry.trim(),
        country: form.country.trim(), password: form.password,
      });
      navigation.navigate('EmailVerification', { email: form.email.trim().toLowerCase(), destination: 'OwnerLogin', accountType: 'owner' });
      showMessage('Check your email', result.message || 'Enter the verification code sent to your company email.');
    } catch (error) {
      showMessage('Registration failed', apiMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (
    label,
    field,
    placeholder,
    options = {}
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#98A2B3"
        value={form[field]}
        onChangeText={(value) => updateField(field, value)}
        secureTextEntry={options.secure && !showPassword}
        keyboardType={options.keyboardType || 'default'}
        autoCapitalize={options.autoCapitalize || 'sentences'}
        autoCorrect={false}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>

            <Pressable
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backText}>← Back</Text>
            </Pressable>

            <View style={styles.heading}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>S</Text>
              </View>

              <Text style={styles.brand}>SmartTracker</Text>
            </View>

            <Text style={styles.eyebrow}>ORGANISATION ONBOARDING</Text>

            <Text style={styles.title}>
              Create your organisation
            </Text>

            <Text style={styles.subtitle}>
              Set up your company's workspace and register as its owner.
            </Text>

            {/* Organisation details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Organisation Details
              </Text>

              {renderInput(
                'Organisation Name *',
                'organisationName',
                'e.g. Divum'
              )}

              {renderInput(
                'Official Email Domain *',
                'domain',
                'e.g. divum.in',
                { autoCapitalize: 'none' }
              )}

              {renderInput(
                'Industry *',
                'industry',
                'e.g. Information Technology'
              )}

              {renderInput(
                'Country *',
                'country',
                'Enter country'
              )}
            </View>

            {/* Owner details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Organisation Owner Details
              </Text>

              {renderInput(
                'Owner Full Name *',
                'ownerName',
                'Enter CEO / Owner name'
              )}

              {renderInput(
                'Official Company Email *',
                'email',
                'name@company.com',
                {
                  keyboardType: 'email-address',
                  autoCapitalize: 'none',
                }
              )}

              {renderInput(
                'Phone Number *',
                'phone',
                'Enter phone number',
                { keyboardType: 'phone-pad' }
              )}
            </View>

            {/* Security */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Account Security
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password *</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Minimum 8 characters"
                  placeholderTextColor="#98A2B3"
                  value={form.password}
                  onChangeText={(value) =>
                    updateField('password', value)
                  }
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password *</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Re-enter your password"
                  placeholderTextColor="#98A2B3"
                  value={form.confirmPassword}
                  onChangeText={(value) =>
                    updateField('confirmPassword', value)
                  }
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>

              <Pressable
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.showPassword}>
                  {showPassword ? 'Hide passwords' : 'Show passwords'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>
                What happens next?
              </Text>

              <Text style={styles.infoText}>
                1. Your organisation details are submitted.
                {'\n'}2. Your official email and domain are verified.
                {'\n'}3. Your organisation workspace is activated.
                {'\n'}4. An initial Admin registration code is generated.
              </Text>
            </View>

            <Pressable
              style={[
                styles.registerButton,
                loading && styles.disabledButton,
              ]}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={styles.registerButtonText}>
                {loading ? 'Creating organisation…' : 'Create Organisation →'}
              </Text>
            </Pressable>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>
                Already an organisation owner?
              </Text>

              <Pressable
                onPress={() => navigation.navigate('OwnerLogin')}
              >
                <Text style={styles.loginLink}>Sign in</Text>
              </Pressable>
            </View>

            <Text style={styles.footer}>
              © 2026 SmartTracker. All rights reserved.
            </Text>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },

  flex: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },

  container: {
    width: '100%',
    maxWidth: 650,
    alignSelf: 'center',
    padding: 24,
  },

  backButton: {
    marginBottom: 25,
  },

  backText: {
    color: '#3157D5',
    fontSize: 15,
    fontWeight: '700',
  },

  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 35,
  },

  logo: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: '#3157D5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoText: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '800',
  },

  brand: {
    color: '#17233D',
    fontSize: 21,
    fontWeight: '800',
  },

  eyebrow: {
    color: '#3157D5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
  },

  title: {
    color: '#17233D',
    fontSize: 29,
    fontWeight: '800',
    marginBottom: 10,
  },

  subtitle: {
    color: '#667085',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 30,
  },

  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E7EAF0',
  },

  sectionTitle: {
    color: '#17233D',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 20,
  },

  inputGroup: {
    marginBottom: 17,
  },

  label: {
    color: '#344054',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9DFE8',
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 13,
    fontSize: 14,
    color: '#17233D',
  },

  showPassword: {
    color: '#3157D5',
    fontSize: 13,
    fontWeight: '700',
  },

  infoBox: {
    backgroundColor: '#EAF0FF',
    borderRadius: 12,
    padding: 17,
    marginBottom: 24,
  },

  infoTitle: {
    color: '#3157D5',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 9,
  },

  infoText: {
    color: '#475467',
    fontSize: 13,
    lineHeight: 23,
  },

  registerButton: {
    backgroundColor: '#3157D5',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },

  disabledButton: {
    opacity: 0.6,
  },

  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 22,
  },

  loginText: {
    color: '#667085',
    fontSize: 13,
  },

  loginLink: {
    color: '#3157D5',
    fontSize: 13,
    fontWeight: '800',
  },

  footer: {
    color: '#98A2B3',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 35,
    marginBottom: 15,
  },
});
