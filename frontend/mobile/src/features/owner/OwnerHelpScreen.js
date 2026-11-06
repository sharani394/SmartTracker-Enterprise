
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { knowledgeBaseService } from '../../services/knowledgeBaseService';
import { apiMessage } from '../../utils/feedback';

export default function OwnerHelpScreen({ navigation }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [category, setCategory] = useState('Technical Issue');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [articles, setArticles] = useState([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [articleError, setArticleError] = useState('');

  useEffect(() => {
    let active = true;
    setLoadingArticles(true); setArticleError('');
    knowledgeBaseService.list({ page: 1, limit: 100, status: 'Published', q: search.trim() || undefined })
      .then((result) => { if (active) setArticles(result.articles || []); })
      .catch((error) => { if (active) setArticleError(apiMessage(error)); })
      .finally(() => { if (active) setLoadingArticles(false); });
    return () => { active = false; };
  }, [search]);

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
        <Text style={styles.description}>
          Ticket creation from this Owner account is not permitted by the backend. Use an Employee account to submit support tickets.
        </Text>

        <Text style={styles.label}>Issue Category</Text>
        <View style={styles.categoryContainer}>
          {['Technical Issue', 'Account Access', 'Billing', 'Other'].map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.categoryButton,
                category === item && styles.categoryActive,
              ]}
            disabled
            onPress={() => setCategory(item)}
            >
              <Text
                style={[
                  styles.categoryText,
                  category === item && styles.categoryActiveText,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Subject</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter support request subject"
          placeholderTextColor="#9CA3AF"
          value={subject}
          onChangeText={setSubject}
          editable={false}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Explain your issue in detail..."
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
          editable={false}
        />

        <TouchableOpacity disabled style={styles.submitButton}>
          <Text style={styles.submitText}>Employee accounts only</Text>
        </TouchableOpacity>

        <Text style={styles.note}>The API only accepts ticket creation from active Employee accounts.</Text>
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
  textArea: { height: 110, paddingTop: 12 },
  faqItem: { borderTopWidth: 1, borderTopColor: '#EEF1F6', paddingVertical: 15 },
  faqHeader: { flexDirection: 'row', alignItems: 'center' },
  question: { flex: 1, color: '#27344D', fontSize: 12, fontWeight: '700' },
  arrow: { color: '#3157D5', fontSize: 20, fontWeight: '700', marginLeft: 10 },
  answer: { color: '#718096', fontSize: 12, lineHeight: 19, marginTop: 10 },
  description: { color: '#8490A3', fontSize: 11, lineHeight: 18 },
  label: { color: '#34415A', fontSize: 12, fontWeight: '700', marginTop: 17 },
  categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  categoryButton: {
    paddingHorizontal: 11, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1, borderColor: '#DDE4EF',
  },
  categoryActive: { backgroundColor: '#EAF0FF', borderColor: '#3157D5' },
  categoryText: { color: '#68758B', fontSize: 10, fontWeight: '600' },
  categoryActiveText: { color: '#3157D5' },
  submitButton: {
    backgroundColor: '#3157D5', padding: 14,
    borderRadius: 10, alignItems: 'center', marginTop: 20,
  },
  submitText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  message: { color: '#3157D5', backgroundColor: '#EAF0FF', padding: 11, borderRadius: 8, fontSize: 12, marginTop: 13 },
  error: { color: '#B42318', backgroundColor: '#FDECEC', padding: 11, borderRadius: 8, fontSize: 12, marginTop: 13 },
  note: { color: '#929CAE', fontSize: 10, lineHeight: 16, marginTop: 12 },
  footer: { textAlign: 'center', color: '#A1AABA', fontSize: 10, marginTop: 15 },
});
