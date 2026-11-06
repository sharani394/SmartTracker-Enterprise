
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

export default function AdminRegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    organisationName: '',
    fullName: '',
    email: '',
    phone: '',
    registrationCode: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { registerPrimaryAdmin } = useAuth();

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const validateForm = () => {
    const requiredFields = [
      'organisationName',
      'fullName',
      'email',
      'phone',
      'registrationCode',
      'password',
      'confirmPassword',
    ];

    for (const field of requiredFields) {
      if (!form[field].trim()) {
        showMessage('Missing information', 'Please fill in all required fields.');
        return false;
      }
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(form.email.trim())) {
      showMessage('Invalid email', 'Please enter a valid company email.');
      return false;
    }

    if (!/^\d{6}$/.test(form.registrationCode.trim())) {
      showMessage('Invalid registration code', 'Please enter the 6-digit code provided by your organisation owner.');
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
      const email = form.email.trim().toLowerCase();
      const result = await registerPrimaryAdmin({
        organisationName: form.organisationName.trim(), fullName: form.fullName.trim(), email,
        phone: form.phone.trim(), registrationCode: form.registrationCode.trim(), password: form.password,
      });
      showMessage('Registration submitted', result.message || 'Verify your company email to activate the Primary Admin account.');
      navigation.navigate('EmailVerification', { email, destination: 'AdminLogin', accountType: 'admin' });
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
        keyboardType={options.keyboardType || 'default'}
        autoCapitalize={options.autoCapitalize || 'sentences'}
        autoCorrect={false}
        secureTextEntry={options.secure && !showPassword}
        maxLength={options.maxLength}
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

            {/* Back navigation */}
            <Pressable
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backText}>← Back</Text>
            </Pressable>

            {/* Branding */}
            <View style={styles.heading}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>S</Text>
              </View>
              <Text style={styles.brand}>SmartTracker</Text>
            </View>

            {/* Page heading */}
            <Text style={styles.eyebrow}>ADMIN ONBOARDING</Text>

            <Text style={styles.title}>
              Register as Organisation Admin
            </Text>

            <Text style={styles.subtitle}>
              Enter your organisation details and the unique registration
              code shared by your organisation owner.
            </Text>

            {/* Organisation information */}
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
                'Official Company Email *',
                'email',
                'admin@divum.in',
                {
                  keyboardType: 'email-address',
                  autoCapitalize: 'none',
                }
              )}
            </View>

            {/* Admin information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Admin Details
              </Text>

              {renderInput(
                'Full Name *',
                'fullName',
                'Enter your full name'
              )}

              {renderInput(
                'Phone Number *',
                'phone',
                'Enter your phone number',
                { keyboardType: 'phone-pad' }
              )}
            </View>

            {/* Organisation verification */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Organisation Verification
              </Text>

              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>
                  Have your registration code?
                </Text>

                <Text style={styles.infoText}>
                  Your organisation owner receives a unique,
                  time-limited registration code after setting up
                  the organisation. Ask the owner to share it with you.
                </Text>
              </View>

              {renderInput(
                '6-Digit Organisation OTP *',
                'registrationCode',
                'Enter your registration code',
                {
                  keyboardType: 'number-pad',
                  autoCapitalize: 'none',
                  maxLength: 6,
                }
              )}
            </View>

            {/* Password */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Account Security
              </Text>

              {renderInput(
                'Password *',
                'password',
                'Minimum 8 characters',
                { secure: true, autoCapitalize: 'none' }
              )}

              {renderInput(
                'Confirm Password *',
                'confirmPassword',
                'Re-enter your password',
                { secure: true, autoCapitalize: 'none' }
              )}

              <Pressable
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.showPassword}>
                  {showPassword ? 'Hide passwords' : 'Show passwords'}
                </Text>
              </Pressable>
            </View>

            {/* Security note */}
            <View style={styles.securityBox}>
              <Text style={styles.securityTitle}>
                <Text>🔒 </Text>
                Secure Organisation Access
              </Text>

              <Text style={styles.securityText}>
                Admin access is granted only after the backend verifies
                your organisation, company email domain and unused
                registration code. The initial code cannot be reused.
              </Text>
            </View>

            {/* Submit */}
            <Pressable
              style={[styles.registerButton, loading && { opacity: 0.65 }]}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={styles.registerButtonText}>
                {loading ? 'Submitting…' : 'Verify & Register as Admin →'}
              </Text>
            </Pressable>

            {/* Login link */}
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>
                Already registered as Admin?
              </Text>

              <Pressable
                onPress={() => navigation.navigate('AdminLogin')}
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
    color: '#16845B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
  },

  title: {
    color: '#17233D',
    fontSize: 28,
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

  infoBox: {
    backgroundColor: '#EAF0FF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },

  infoTitle: {
    color: '#3157D5',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 7,
  },

  infoText: {
    color: '#475467',
    fontSize: 13,
    lineHeight: 21,
  },

  showPassword: {
    color: '#3157D5',
    fontSize: 13,
    fontWeight: '700',
  },

  securityBox: {
    backgroundColor: '#E8F7EF',
    borderRadius: 12,
    padding: 17,
    marginBottom: 24,
  },

  securityTitle: {
    color: '#16845B',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },

  securityText: {
    color: '#475467',
    fontSize: 13,
    lineHeight: 21,
  },

  registerButton: {
    backgroundColor: '#16845B',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
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
