
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { knowledgeBaseService } from '../../services/knowledgeBaseService';
import { organisationService } from '../../services/organisationService';
import { apiMessage, showMessage } from '../../utils/feedback';

export default function OwnerHelpScreen({ navigation }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [articleError, setArticleError] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [loadingSupportEmail, setLoadingSupportEmail] = useState(true);
  const [supportEmailError, setSupportEmailError] = useState('');

  useEffect(() => {
    let active = true;
    setLoadingArticles(true); setArticleError('');
    knowledgeBaseService.list({ page: 1, limit: 100, status: 'Published', q: search.trim() || undefined })
      .then((result) => { if (active) setArticles(result.articles || []); })
      .catch((error) => { if (active) setArticleError(apiMessage(error)); })
      .finally(() => { if (active) setLoadingArticles(false); });
    return () => { active = false; };
  }, [search]);

  useEffect(() => {
    let active = true;
    organisationService.getSettings()
      .then((result) => {
        if (active) setSupportEmail(result.organisation?.settings?.supportEmail || '');
      })
      .catch((error) => {
        if (active) setSupportEmailError(apiMessage(error));
      })
      .finally(() => {
        if (active) setLoadingSupportEmail(false);
      });
    return () => { active = false; };
  }, []);

  const contactSupport = async () => {
    if (!supportEmail) return;
    const url = `mailto:${supportEmail}?subject=${encodeURIComponent('SmartTracker support request')}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        showMessage('Email app unavailable', `Contact support at ${supportEmail}.`);
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      showMessage('Could not open email app', `Contact support at ${supportEmail}. ${apiMessage(error)}`);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Back to Owner Settings</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Help & Support</Text>
      <Text style={styles.subtitle}>
        Find answers and get help with your SmartTracker workspace.
      </Text>

      <View style={styles.banner}>
        <Text style={styles.bannerIcon}>💬</Text>
        <Text style={styles.bannerTitle}>How can we help?</Text>
        <Text style={styles.bannerText}>
          Search frequently asked questions or submit a support request.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Frequently Asked Questions</Text>

        <TextInput
          style={styles.input}
          placeholder="Search questions..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />

        {loadingArticles ? <Text style={styles.description}>Loading published articles…</Text> : null}
        {articleError ? <Text style={styles.error}>{articleError}</Text> : null}
        {articles.map((article, index) => (
          <TouchableOpacity
            key={article.id}
            style={styles.faqItem}
            onPress={() => setExpanded(expanded === index ? null : index)}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.question}>{article.title}</Text>
              <Text style={styles.arrow}>{expanded === index ? '−' : '+'}</Text>
            </View>

            {expanded === index && (
              <Text style={styles.answer}>{article.content || article.summary || 'This article has no body content.'}</Text>
            )}
          </TouchableOpacity>
        ))}

        {!loadingArticles && !articleError && articles.length === 0 && (
          <Text style={styles.description}>{search ? 'No matching published articles found.' : 'No published knowledge-base articles are available.'}</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contact Support</Text>
        {loadingSupportEmail ? (
          <Text style={styles.description}>Loading your organisation support contact…</Text>
        ) : supportEmailError ? (
          <Text style={styles.error}>{supportEmailError}</Text>
        ) : supportEmail ? (
          <>
            <Text style={styles.description}>Email your configured support contact for help with this workspace.</Text>
            <Text style={styles.supportAddress}>{supportEmail}</Text>
            <TouchableOpacity style={styles.submitButton} onPress={contactSupport} accessibilityRole="button">
              <Text style={styles.submitText}>Email support</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.description}>
            No support contact is configured yet. Add a support email under Organisation settings to enable direct contact.
          </Text>
        )}
      </View>

      <Text style={styles.footer}>SmartTracker · Help Centre</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FC' },
  content: { padding: 20, paddingBottom: 40 },
  back: { color: '#3157D5', fontWeight: '700', marginBottom: 22 },
  title: { fontSize: 24, fontWeight: '800', color: '#17233D' },
  subtitle: { color: '#7B8799', fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 20 },
  banner: {
    backgroundColor: '#263F91', padding: 22,
    borderRadius: 15, marginBottom: 16,
  },
  bannerIcon: { fontSize: 27, marginBottom: 10 },
  bannerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  bannerText: { color: '#DCE5FF', fontSize: 12, lineHeight: 19, marginTop: 6 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 15,
    padding: 17, marginBottom: 16,
    borderWidth: 1, borderColor: '#EAEFF5',
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#17233D', marginBottom: 12 },
  input: {
    minHeight: 46, borderWidth: 1, borderColor: '#DDE4EF',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    color: '#27344D', marginTop: 12, backgroundColor: '#FFFFFF',
  },
  faqItem: { borderTopWidth: 1, borderTopColor: '#EEF1F6', paddingVertical: 15 },
  faqHeader: { flexDirection: 'row', alignItems: 'center' },
  question: { flex: 1, color: '#27344D', fontSize: 12, fontWeight: '700' },
  arrow: { color: '#3157D5', fontSize: 20, fontWeight: '700', marginLeft: 10 },
  answer: { color: '#718096', fontSize: 12, lineHeight: 19, marginTop: 10 },
  description: { color: '#8490A3', fontSize: 11, lineHeight: 18 },
  supportAddress: { color: '#27344D', fontSize: 14, fontWeight: '700', marginTop: 10 },
  submitButton: {
    backgroundColor: '#3157D5', padding: 14,
    borderRadius: 10, alignItems: 'center', marginTop: 20,
  },
  submitText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  message: { color: '#3157D5', backgroundColor: '#EAF0FF', padding: 11, borderRadius: 8, fontSize: 12, marginTop: 13 },
  error: { color: '#B42318', backgroundColor: '#FDECEC', padding: 11, borderRadius: 8, fontSize: 12, marginTop: 13 },
  footer: { textAlign: 'center', color: '#A1AABA', fontSize: 10, marginTop: 15 },
});
