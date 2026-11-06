
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
  Modal,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiMessage, showMessage } from '../../utils/feedback';

const departments = [
  'Software Development',
  'Networking',
  'Hardware',
  'IT Support',
  'Cybersecurity',
  'Cloud Computing',
  'DevOps',
  'Database Administration',
  'Quality Assurance / Testing',
  'Data Analytics',
  'Artificial Intelligence / Machine Learning',
  'Human Resources',
  'Finance',
  'Operations',
  'Other',
];

const accountTypes = ['Employee', 'Support Agent'];

const experienceOptions = [
  'Fresher',
  'Less than 1 year',
  '1–2 years',
  '3–5 years',
  '6–10 years',
  'More than 10 years',
];

export default function MemberRegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    organisationName: '',
    email: '',
    fullName: '',
    phone: '',
    employeeId: '',
    accountType: '',
    department: '',
    jobTitle: '',
    skills: '',
    experience: '',
    password: '',
    confirmPassword: '',
  });

  const [dropdown, setDropdown] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { registerMember } = useAuth();

  const updateField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const openDropdown = (field, options) => {
    setDropdown({ field, options });
  };

  const selectDropdownValue = (value) => {
    updateField(dropdown.field, value);
    setDropdown(null);
  };

  const validateForm = () => {
    const requiredFields = [
      'organisationName',
      'email',
      'fullName',
      'phone',
      'accountType',
      'department',
      'jobTitle',
      'experience',
      'password',
      'confirmPassword',
    ];

    for (const field of requiredFields) {
      if (!form[field].trim()) {
        showMessage('Missing information', 'Please complete all required fields.');
        return false;
      }
    }

    const email = form.email.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      showMessage('Invalid email', 'Please enter a valid company email.');
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

    if (form.phone.replace(/\D/g, '').length < 10) {
      showMessage('Invalid phone number', 'Please enter a valid phone number.');
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const email = form.email.trim().toLowerCase();
      const result = await registerMember({
        organisationName: form.organisationName.trim(), email, fullName: form.fullName.trim(), phone: form.phone.trim(),
        employeeId: form.employeeId.trim(), accountType: form.accountType, department: form.department,
        jobTitle: form.jobTitle.trim(), experience: form.experience, skills: form.skills.trim(), password: form.password,
      });
      showMessage('Registration submitted', result.message || 'Verify your company email. Your organisation administrator must approve your registration.');
      navigation.navigate('EmailVerification', { email, destination: 'MemberLogin', accountType: 'member' });
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
      <Text style={styles.label}>
        {label}
        {options.required === false ? ' (Optional)' : ' *'}
      </Text>

      <TextInput
        style={[
          styles.input,
          options.multiline && styles.multilineInput,
        ]}
        placeholder={placeholder}
        placeholderTextColor="#98A2B3"
        value={form[field]}
        onChangeText={(value) => updateField(field, value)}
        keyboardType={options.keyboardType || 'default'}
        autoCapitalize={options.autoCapitalize || 'sentences'}
        autoCorrect={false}
        secureTextEntry={options.secure && !showPassword}
        multiline={options.multiline || false}
        numberOfLines={options.numberOfLines || 1}
      />
    </View>
  );

  const renderDropdown = (label, field, options, placeholder) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label} *</Text>

      <Pressable
        style={styles.dropdown}
        onPress={() => openDropdown(field, options)}
      >
        <Text
          style={[
            styles.dropdownText,
            !form[field] && styles.placeholderText,
          ]}
        >
          {form[field] || placeholder}
        </Text>

        <Text style={styles.dropdownArrow}>⌄</Text>
      </Pressable>
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

            {/* Back button */}
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

            {/* Introduction */}
            <Text style={styles.eyebrow}>TEAM MEMBER ONBOARDING</Text>

            <Text style={styles.title}>
              Join your organisation
            </Text>

            <Text style={styles.subtitle}>
              Register as an Employee or Support Agent. Your organisation
              Admin will review and approve your registration.
            </Text>

            {/* Organisation details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Organisation Details
              </Text>

              {renderInput(
                'Organisation Name',
                'organisationName',
                'e.g. Divum'
              )}

              {renderInput(
                'Official Company Email',
                'email',
                'name@company.com',
                {
                  keyboardType: 'email-address',
                  autoCapitalize: 'none',
                }
              )}

              <View style={styles.hintBox}>
                <Text style={styles.hintText}>
                  Use your organisation's official email address.
                  Your organisation and email domain will be verified.
                  No registration OTP is required for this process.
                </Text>
              </View>
            </View>

            {/* Personal details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Personal Information
              </Text>

              {renderInput(
                'Full Name',
                'fullName',
                'Enter your full name'
              )}

              {renderInput(
                'Phone Number',
                'phone',
                'Enter your phone number',
                { keyboardType: 'phone-pad' }
              )}

              {renderInput(
                'Employee ID',
                'employeeId',
                'Enter employee ID',
                { required: false }
              )}
            </View>

            {/* Professional details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Professional Information
              </Text>

              {renderDropdown(
                'Account Type',
                'accountType',
                accountTypes,
                'Select Employee or Support Agent'
              )}

              {renderDropdown(
                'Department / Technical Domain',
                'department',
                departments,
                'Select your department'
              )}

              {renderInput(
                'Job Title / Designation',
                'jobTitle',
                'e.g. Software Engineer'
              )}

              {renderInput(
                'Skills / Areas of Expertise',
                'skills',
                'e.g. React, Python, Networking',
                {
                  required: false,
                  multiline: true,
                  numberOfLines: 3,
                }
              )}

              {renderDropdown(
                'Years of Experience',
                'experience',
                experienceOptions,
                'Select your experience'
              )}
            </View>

            {/* Account security */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Account Security
              </Text>

              {renderInput(
                'Password',
                'password',
                'Minimum 8 characters',
                {
                  secure: true,
                  autoCapitalize: 'none',
                }
              )}

              {renderInput(
                'Confirm Password',
                'confirmPassword',
                'Re-enter your password',
                {
                  secure: true,
                  autoCapitalize: 'none',
                }
              )}

              <Pressable
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.showPassword}>
                  {showPassword ? 'Hide passwords' : 'Show passwords'}
                </Text>
              </Pressable>
            </View>

            {/* Approval information */}
            <View style={styles.approvalBox}>
              <Text style={styles.approvalTitle}>
                Your registration requires Admin approval
              </Text>

              <Text style={styles.approvalText}>
                1. Your organisation and company email are verified.
                {'\n\n'}
                2. An email verification link or OTP is sent to you.
                {'\n\n'}
                3. After email verification, your request is sent to
                your organisation Admin.
                {'\n\n'}
                4. You can access SmartTracker after the Admin accepts
                your registration.
              </Text>
            </View>

            {/* Submit */}
            <Pressable
              style={[styles.registerButton, loading && { opacity: 0.65 }]}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={styles.registerButtonText}>
                {loading ? 'Submitting…' : 'Submit Registration →'}
              </Text>
            </Pressable>

            {/* Login */}
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>
                Already have an account?
              </Text>

              <Pressable
                onPress={() => navigation.navigate('MemberLogin')}
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

      {/* Reusable dropdown modal */}
      <Modal
        visible={!!dropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdown(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDropdown(null)}
        >
          <Pressable
            style={styles.modalContent}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={styles.modalTitle}>
              Select an option
            </Text>

            <ScrollView style={styles.optionsList}>
              {dropdown?.options.map((option) => (
                <Pressable
                  key={option}
                  style={styles.option}
                  onPress={() => selectDropdownValue(option)}
                >
                  <Text style={styles.optionText}>{option}</Text>

                  {form[dropdown.field] === option && (
                    <Text style={styles.selectedMark}>✓</Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              style={styles.modalClose}
              onPress={() => setDropdown(null)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    color: '#C47720',
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

  multilineInput: {
    minHeight: 85,
    textAlignVertical: 'top',
  },

  dropdown: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9DFE8',
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dropdownText: {
    color: '#17233D',
    fontSize: 14,
    flex: 1,
  },

  placeholderText: {
    color: '#98A2B3',
  },

  dropdownArrow: {
    color: '#667085',
    fontSize: 21,
  },

  hintBox: {
    backgroundColor: '#EAF0FF',
    borderRadius: 9,
    padding: 13,
  },

  hintText: {
    color: '#475467',
    fontSize: 12,
    lineHeight: 19,
  },

  showPassword: {
    color: '#3157D5',
    fontSize: 13,
    fontWeight: '700',
  },

  approvalBox: {
    backgroundColor: '#FFF3E5',
    borderRadius: 12,
    padding: 17,
    marginBottom: 24,
  },

  approvalTitle: {
    color: '#A65C13',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },

  approvalText: {
    color: '#475467',
    fontSize: 13,
    lineHeight: 21,
  },

  registerButton: {
    backgroundColor: '#3157D5',
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

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },

  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    maxHeight: '75%',
  },

  modalTitle: {
    color: '#17233D',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 15,
  },

  optionsList: {
    maxHeight: 420,
  },

  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
  },

  optionText: {
    color: '#344054',
    fontSize: 14,
    flex: 1,
  },

  selectedMark: {
    color: '#3157D5',
    fontWeight: '800',
    fontSize: 17,
  },

  modalClose: {
    backgroundColor: '#F2F4F7',
    borderRadius: 9,
    padding: 13,
    alignItems: 'center',
    marginTop: 15,
  },

  modalCloseText: {
    color: '#344054',
    fontWeight: '700',
  },
});
