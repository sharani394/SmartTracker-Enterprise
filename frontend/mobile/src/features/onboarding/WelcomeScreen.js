
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  ScrollView,
  useWindowDimensions,
} from 'react-native';

const registrationOptions = [
  {
    id: 'organisation',
    title: 'Organisation Owner',
    subtitle: 'For CEOs and organisation owners creating a new workspace.',
    icon: '🏢',
    color: '#3157D5',
    background: '#EAF0FF',
    registerRoute: 'OrganisationRegister',
    loginRoute: 'OwnerLogin',
  },
  {
    id: 'admin',
    title: 'Organisation Admin',
    subtitle: 'Manage employees, support agents, departments and tickets.',
    icon: '🛡️',
    color: '#16845B',
    background: '#E8F7EF',
    registerRoute: 'AdminRegister',
    loginRoute: 'AdminLogin',
  },
  {
    id: 'member',
    title: 'Employee / Support Agent',
    subtitle: 'Join your organisation to raise requests or resolve support tickets.',
    icon: '👥',
    color: '#C47720',
    background: '#FFF3E5',
    registerRoute: 'MemberRegister',
    loginRoute: 'MemberLogin',
  },
];

export default function WelcomeScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 800;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>S</Text>
            </View>

            <Text style={styles.brand}>SmartTracker</Text>
          </View>

          {/* Introduction */}
          <View style={styles.intro}>
            <Text style={styles.eyebrow}>
              SMARTER WORKFLOW. BETTER SUPPORT.
            </Text>

            <Text style={styles.title}>
              Manage every issue.
              {'\n'}
              <Text style={styles.highlight}>
                Empower every team.
              </Text>
            </Text>

            <Text style={styles.description}>
              A unified platform for organisations to manage support
              requests, coordinate teams and resolve issues efficiently.
            </Text>
          </View>

          {/* Registration and Login Options */}
          <View style={styles.registrationSection}>
            <Text style={styles.sectionTitle}>
              Get started with SmartTracker
            </Text>

            <Text style={styles.sectionSubtitle}>
              Select your account type to register or sign in.
            </Text>

            <View
              style={[
                styles.cardsContainer,
                isWideScreen && styles.wideCardsContainer,
              ]}
            >
              {registrationOptions.map((option) => (
                <View
                  key={option.id}
                  style={[
                    styles.card,
                    isWideScreen && styles.wideCard,
                  ]}
                >
                  {/* Icon */}
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: option.background },
                    ]}
                  >
                    <Text style={styles.cardIcon}>
                      {option.icon}
                    </Text>
                  </View>

                  {/* Card Content */}
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>
                      {option.title}
                    </Text>

                    <Text style={styles.cardSubtitle}>
                      {option.subtitle}
                    </Text>

                    {/* Register Button */}
                    <Pressable
                      style={({ pressed }) => [
                        styles.registerButton,
                        { backgroundColor: option.color },
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() =>
                        navigation.navigate(option.registerRoute)
                      }
                    >
                      <Text style={styles.registerButtonText}>
                        Register →
                      </Text>
                    </Pressable>

                    {/* Login Button */}
                    <Pressable
                      style={styles.loginButton}
                      onPress={() =>
                        navigation.navigate(option.loginRoute)
                      }
                    >
                      <Text style={styles.loginButtonText}>
                        Already registered? Sign in
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Footer */}
          <Text style={styles.footer}>
            © 2026 SmartTracker. All rights reserved.
          </Text>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },

  scrollContent: {
    flexGrow: 1,
  },

  container: {
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 30,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 55,
  },

  logo: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#3157D5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },

  brand: {
    fontSize: 21,
    fontWeight: '800',
    color: '#17233D',
  },

  intro: {
    maxWidth: 750,
    marginBottom: 42,
  },

  eyebrow: {
    color: '#3157D5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 18,
  },

  title: {
    color: '#17233D',
    fontSize: 38,
    lineHeight: 48,
    fontWeight: '800',
    marginBottom: 16,
  },

  highlight: {
    color: '#3157D5',
  },

  description: {
    color: '#667085',
    fontSize: 16,
    lineHeight: 25,
    maxWidth: 620,
  },

  registrationSection: {
    marginBottom: 32,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#17233D',
    marginBottom: 8,
  },

  sectionSubtitle: {
    fontSize: 14,
    color: '#667085',
    marginBottom: 22,
  },

  cardsContainer: {
    gap: 16,
  },

  wideCardsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7EAF0',
    borderRadius: 14,
    padding: 20,
    gap: 15,
    minHeight: 190,
  },

  wideCard: {
    flexDirection: 'column',
    minHeight: 260,
  },

  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardIcon: {
    fontSize: 23,
  },

  cardContent: {
    flex: 1,
    gap: 10,
  },

  cardTitle: {
    color: '#17233D',
    fontSize: 16,
    fontWeight: '800',
  },

  cardSubtitle: {
    color: '#667085',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 5,
  },

  registerButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },

  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  buttonPressed: {
    opacity: 0.8,
  },

  loginButton: {
    paddingVertical: 9,
    alignItems: 'center',
  },

  loginButtonText: {
    color: '#3157D5',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  footer: {
    textAlign: 'center',
    color: '#98A2B3',
    fontSize: 12,
    marginTop: 20,
  },
});
