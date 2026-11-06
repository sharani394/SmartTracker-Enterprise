
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiMessage, navigateByRole, showMessage, showSignInMessage } from '../../utils/feedback';

export default function MemberLoginScreen({ navigation, route }) {
  const [role, setRole] = useState(route.params?.accountType === 'Support Agent' ? 'agent' : 'employee');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      showMessage('Missing details', 'Enter your company email and password.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(cleanEmail)) {
      showMessage('Invalid email', 'Enter a valid company email address.');
      return;
    }

    setLoading(true);
    try {
      const expectedRole = role === 'agent' ? 'SUPPORT_AGENT' : 'EMPLOYEE';
      const user = await login(cleanEmail, password, [expectedRole]);
      showSignInMessage(user);
      navigateByRole(navigation, user.role);
    } catch (error) {
      showMessage(error.code === 'LOGIN_PORTAL_MISMATCH' ? 'Wrong sign-in option' : 'Sign in failed', apiMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <Text style={styles.logo}>ST</Text>
        </View>

        <Text style={styles.brand}>SmartTracker</Text>
        <Text style={styles.heading}>{role === 'agent' ? 'Support Agent Sign In' : 'Employee Sign In'}</Text>
        <Text style={styles.subtitle}>
          Sign in to raise tickets or manage your assigned support requests.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Select Your Role</Text>

          <View style={styles.roleContainer}>
            <TouchableOpacity
              style={[
                styles.roleButton,
                role === 'employee' && styles.selectedRole,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: role === 'employee' }}
              accessibilityLabel="Employee sign in"
              onPress={() => setRole('employee')}
            >
              <Text style={styles.roleIcon}>👤</Text>
              <Text
                style={[
                  styles.roleTitle,
                  role === 'employee' && styles.selectedRoleText,
                ]}
              >
                Employee
              </Text>
              <Text style={styles.roleDescription}>Raise and track tickets</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleButton,
                role === 'agent' && styles.selectedRole,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: role === 'agent' }}
              accessibilityLabel="Support Agent sign in"
              onPress={() => setRole('agent')}
            >
              <Text style={styles.roleIcon}>🛠️</Text>
              <Text
                style={[
                  styles.roleTitle,
                  role === 'agent' && styles.selectedRoleText,
                ]}
              >
                Support Agent
              </Text>
              <Text style={styles.roleDescription}>Manage assigned tickets</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Company Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@company.com"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            accessibilityLabel="Company Email"
            returnKeyType="next"
          />

          <Text style={styles.label}>Password</Text>
          <View style={[styles.passwordContainer, passwordFocused && styles.passwordContainerFocused]}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="current-password"
              accessibilityLabel="Password"
              selectionColor="#16845B"
              returnKeyType="done"
              underlineColorAndroid="transparent"
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              onSubmitEditing={handleLogin}
            />

            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Text style={styles.showText}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.forgotButton}
            onPress={() => navigation.navigate('PasswordReset', {
              email,
              destination: 'MemberLogin',
              destinationParams: { accountType: role === 'agent' ? 'Support Agent' : 'Employee' },
            })}
            accessibilityRole="button"
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
          >
            <Text style={styles.loginButtonText}>
              {loading ? 'Signing in…' : `Sign In as ${role === 'agent' ? 'Support Agent' : 'Employee'}`}
            </Text>
          </TouchableOpacity>

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>New to SmartTracker? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('MemberRegister', {
                accountType: role === 'agent' ? 'Support Agent' : 'Employee',
              })}
              accessibilityRole="button"
              accessibilityLabel={`Register as ${role === 'agent' ? 'Support Agent' : 'Employee'}`}
            >
              <Text style={styles.registerLink}>Register as {role === 'agent' ? 'Support Agent' : 'Employee'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.footer}>
          SmartTracker Member Workspace
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
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 25,
  },
  backText: {
    color: '#526078',
    fontSize: 15,
    fontWeight: '600',
  },
  logoContainer: {
    width: 58,
    height: 58,
    borderRadius: 17,
    backgroundColor: '#16845B',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  logo: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '800',
  },
  brand: {
    color: '#16845B',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 25,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: '#17233D',
    textAlign: 'center',
    marginBottom: 9,
  },
  subtitle: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 25,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 21,
    shadowColor: '#17233D',
    shadowOpacity: 0.06,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  label: {
    color: '#27344D',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 9,
    marginTop: 8,
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 17,
    gap: 10,
  },
  roleButton: {
    flex: 1,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#E1E6EF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  selectedRole: {
    borderColor: '#16845B',
    backgroundColor: '#E8F7EF',
  },
  roleIcon: {
    fontSize: 23,
    marginBottom: 7,
  },
  roleTitle: {
    color: '#27344D',
    fontSize: 13,
    fontWeight: '800',
  },
  selectedRoleText: {
    color: '#16845B',
  },
  roleDescription: {
    color: '#718096',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 5,
  },
  input: {
    height: 51,
    borderWidth: 1,
    borderColor: '#E1E6EF',
    borderRadius: 11,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#17233D',
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
  },
  passwordContainer: {
    height: 51,
    borderWidth: 1,
    borderColor: '#E1E6EF',
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  passwordContainerFocused: {
    borderColor: '#16845B',
    shadowColor: '#16845B',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  passwordInput: {
    flex: 1,
    color: '#17233D',
    fontSize: 14,
    outlineStyle: 'none',
    outlineWidth: 0,
    outlineColor: 'transparent',
  },
  showText: {
    color: '#16845B',
    fontSize: 13,
    fontWeight: '700',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: 11,
    marginBottom: 18,
  },
  forgotText: {
    color: '#16845B',
    fontSize: 12,
    fontWeight: '600',
  },
  loginButton: {
    height: 53,
    backgroundColor: '#16845B',
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonDisabled: { opacity: 0.65 },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 22,
  },
  registerText: {
    color: '#718096',
    fontSize: 13,
  },
  registerLink: {
    color: '#16845B',
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    textAlign: 'center',
    color: '#9AA4B5',
    fontSize: 12,
    marginTop: 24,
  },
});
