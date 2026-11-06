
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

          <View style={[styles.hero, isWideScreen && styles.wideHero]}>
            <View style={[styles.intro, isWideScreen && styles.wideIntro]}>
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
                Bring support requests, people and progress together in one clear workspace.
              </Text>
            </View>

            {isWideScreen ? (
              <View
                style={styles.previewCard}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <View style={styles.previewHeader}>
                  <View style={styles.previewMark}><Text style={styles.previewMarkText}>S</Text></View>
                  <View>
                    <Text style={styles.previewEyebrow}>WORKSPACE PREVIEW</Text>
                    <Text style={styles.previewHeading}>A clearer way to work</Text>
                  </View>
                </View>
                <View style={styles.previewDivider} />
                {[
                  ['01', 'Capture every request', 'Keep the details together', '#3157D5', '#EAF0FF'],
                  ['02', 'Connect the right team', 'Make ownership clear', '#16845B', '#E8F7EF'],
                  ['03', 'Move work forward', 'Track progress to resolution', '#A45E12', '#FFF3E5'],
                ].map(([number, title, description, color, background]) => (
                  <View style={styles.previewRow} key={number}>
                    <View style={[styles.previewNumber, { backgroundColor: background }]}>
                      <Text style={[styles.previewNumberText, { color }]}>{number}</Text>
                    </View>
                    <View style={styles.previewCopy}>
                      <Text style={styles.previewRowTitle}>{title}</Text>
                      <Text style={styles.previewRowDescription}>{description}</Text>
                    </View>
                    <Text style={[styles.previewArrow, { color }]}>›</Text>
                  </View>
                ))}
                <View style={styles.previewFoot}>
                  <View style={styles.previewFootDot} />
                  <Text style={styles.previewFootText}>One connected support workflow</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Registration and Login Options */}
          <View style={styles.registrationSection}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Choose your workspace</Text>
              <Text style={styles.sectionSubtitle}>
                Select your role to create an account or continue to sign in.
              </Text>
            </View>

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
    marginBottom: 42,
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

  hero: {
    marginBottom: 10,
  },

  wideHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 48,
    marginBottom: 44,
  },

  wideIntro: {
    flex: 1,
    maxWidth: 570,
    marginBottom: 0,
  },

  previewCard: {
    width: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5EAF3',
    padding: 21,
    shadowColor: '#17233D',
    shadowOpacity: 0.07,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
  },

  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },

  previewMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#3157D5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  previewMarkText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  previewEyebrow: { color: '#8A96AA', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  previewHeading: { color: '#17233D', fontSize: 14, fontWeight: '800', marginTop: 3 },
  previewDivider: { height: 1, backgroundColor: '#EEF1F6', marginBottom: 8 },

  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F7',
  },

  previewNumber: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  previewNumberText: { fontSize: 10, fontWeight: '800' },
  previewCopy: { flex: 1 },
  previewRowTitle: { color: '#27344D', fontSize: 11, fontWeight: '800' },
  previewRowDescription: { color: '#8490A3', fontSize: 10, marginTop: 4 },
  previewArrow: { fontSize: 23, marginLeft: 8 },

  previewFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: '#F6F8FC',
  },

  previewFootDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#16845B', marginRight: 8 },
  previewFootText: { color: '#667085', fontSize: 10, fontWeight: '600' },

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

  sectionHeading: {
    marginBottom: 22,
  },

  sectionSubtitle: {
    fontSize: 14,
    color: '#667085',
    marginTop: 7,
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
