
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

export default function AdminLoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      showMessage('Missing details', 'Please enter your company email and password.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(trimmedEmail)) {
      showMessage('Invalid email', 'Please enter a valid company email.');
      return;
    }

    setLoading(true);
    try {
      const user = await login(trimmedEmail, password, ['PRIMARY_ADMIN', 'INTERNAL_ADMIN']);
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

        <Text style={styles.heading}>Admin Sign In</Text>

        <Text style={styles.subtitle}>
          Access your organisation's workspace and manage daily operations.
        </Text>

        <View style={styles.card}>
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>🛡️</Text>
            <Text style={styles.infoText}>
              Secure access for Primary and Internal Admins
            </Text>
          </View>

          <Text style={styles.label}>Company Email</Text>

          <TextInput
            style={styles.input}
            placeholder="admin@company.com"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            returnKeyType="next"
          />

          <View style={styles.passwordHeader}>
            <Text style={styles.label}>Password</Text>

            <TouchableOpacity
              onPress={() => navigation.navigate('PasswordReset', { email, destination: 'AdminLogin' })}
              accessibilityRole="button"
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.showText}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            activeOpacity={0.8}
            disabled={loading}
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
          >
            <Text style={styles.loginButtonText}>{loading ? 'Signing in…' : 'Sign In as Admin'}</Text>
          </TouchableOpacity>

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>New Primary Admin? </Text>

            <TouchableOpacity
              onPress={() => navigation.navigate('AdminRegister')}
            >
              <Text style={styles.registerLink}>Register Here</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.registerRow} onPress={() => navigation.navigate('InternalAdminInvitation')}>
            <Text style={styles.registerLink}>Accept an Internal Admin invitation</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          SmartTracker Organisation Administration
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
    marginBottom: 28,
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
    marginBottom: 30,
  },
  heading: {
    fontSize: 29,
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
    marginBottom: 30,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#17233D',
    shadowOpacity: 0.06,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F7EF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  infoText: {
    flex: 1,
    color: '#16845B',
    fontSize: 12,
    fontWeight: '600',
  },
  label: {
    color: '#27344D',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 9,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E1E6EF',
    borderRadius: 11,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#17233D',
    marginBottom: 22,
    backgroundColor: '#FFFFFF',
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgotText: {
    color: '#16845B',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 9,
  },
  passwordContainer: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E1E6EF',
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 25,
  },
  passwordInput: {
    flex: 1,
    color: '#17233D',
    fontSize: 14,
  },
  showText: {
    color: '#16845B',
    fontSize: 13,
    fontWeight: '700',
  },
  loginButton: {
    height: 53,
    backgroundColor: '#16845B',
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 23,
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
    marginTop: 25,
  },
});
