
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useTickets } from '../../context/TicketContext';
import { useAuth } from '../../context/AuthContext';
import { knowledgeBaseService } from '../../services/knowledgeBaseService';
import { apiMessage, showMessage } from '../../utils/feedback';

const GREEN = '#16845B';

const categories = ['Hardware', 'Software', 'Network', 'Access', 'Other'];
const priorities = ['Low', 'Medium', 'High', 'Critical'];
const statusTransitions = {
  Assigned: ['In Progress', 'On Hold'],
  'In Progress': ['On Hold', 'Resolved'],
  'On Hold': ['In Progress', 'Resolved'],
};

export default function MemberPortalScreen({ navigation, route }) {
  const { user, logout, updateProfile } = useAuth();
  const isAgent = user?.role === 'SUPPORT_AGENT';
  const email = user?.email || '';
  const displayName = user?.fullName || '';

  const {
    tickets,
    notifications,
    createTicket,
    getTicket,
    updateTicketStatus,
    respondToAssignment,
    addComment,
    markNotificationsRead,
    setNotificationRead,
    isLoading: isTicketLoading,
    error: ticketError,
  } = useTickets();

  const [activeTab, setActiveTab] = useState('Dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Hardware');
  const [priority, setPriority] = useState('Medium');

  const [commentText, setCommentText] = useState('');
  const [internalNoteText, setInternalNoteText] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const [profileName, setProfileName] = useState(displayName);
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [submitting, setSubmitting] = useState(false);
  const [knowledgeArticles, setKnowledgeArticles] = useState([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState('');
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
  const [profileMessage, setProfileMessage] = useState('');

  const myTickets = tickets;
  const myNotifications = notifications;

  const selectedTicket = myTickets.find(
    (ticket) => ticket.id === selectedTicketId
  );

  const countStatus = (status) =>
    myTickets.filter((ticket) => ticket.status === status).length;

  const unreadCount = myNotifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    setProfileName(displayName);
    setProfilePhone(user?.phone || '');
  }, [displayName, user?.phone]);

  useEffect(() => {
    let active = true;
    setKnowledgeLoading(true);
    setKnowledgeError('');
    knowledgeBaseService.list({ page: 1, limit: 100, status: 'Published', q: knowledgeSearch.trim() || undefined })
      .then((result) => { if (active) setKnowledgeArticles(result.articles || []); })
      .catch((error) => { if (active) setKnowledgeError(apiMessage(error)); })
      .finally(() => { if (active) setKnowledgeLoading(false); });
    return () => { active = false; };
  }, [knowledgeSearch]);

  const openTicketDetails = (ticketId) => {
    setSelectedTicketId(ticketId);
    setActiveTab('Ticket Details');
  };

  const submitTicket = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Missing details', 'Enter the ticket title and description.');
      return;
    }

    setSubmitting(true);
    try {
      const newTicket = await createTicket({ title: title.trim(), description: description.trim(), category, priority, department: user?.department || '' });
      await getTicket(newTicket.id);
      setTitle(''); setDescription(''); setCategory('Hardware'); setPriority('Medium');
      setSelectedTicketId(newTicket.id); setActiveTab('Ticket Details');
      showMessage('Ticket submitted', `Your ticket ID is ${newTicket.ticketNumber || newTicket.id}.`);
    } catch (error) {
      showMessage('Could not submit ticket', apiMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const submitPublicComment = async () => {
    if (!commentText.trim() || !selectedTicket) return;
    setSubmitting(true);
    try { await addComment(selectedTicket.id, commentText.trim(), false); setCommentText(''); }
    catch (error) { showMessage('Could not send comment', apiMessage(error)); }
    finally { setSubmitting(false); }
  };

  const submitInternalNote = async () => {
    if (!internalNoteText.trim() || !selectedTicket || !isAgent) return;
    setSubmitting(true);
    try { await addComment(selectedTicket.id, internalNoteText.trim(), true); setInternalNoteText(''); showMessage('Saved', 'Your internal note has been saved.'); }
    catch (error) { showMessage('Could not save internal note', apiMessage(error)); }
    finally { setSubmitting(false); }
  };

  const handleAccept = async () => {
    setSubmitting(true);
    try { await respondToAssignment(selectedTicket.id, true); showMessage('Accepted', 'You have accepted this ticket.'); }
    catch (error) { showMessage('Could not accept assignment', apiMessage(error)); }
    finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Reason required', 'Please enter a reason for rejecting.');
      return;
    }

    setSubmitting(true);
    try {
      await respondToAssignment(selectedTicket.id, false, rejectReason.trim());
      setRejectReason('');
      showMessage('Assignment rejected', 'The admin will need to reassign this ticket.');
      setActiveTab('My Tickets');
      setSelectedTicketId(null);
    } catch (error) { showMessage('Could not reject assignment', apiMessage(error)); }
    finally { setSubmitting(false); }
  };

  const changeStatus = async (newStatus) => {
    if (!selectedTicket || !isAgent) return;

    if (selectedTicket.acceptance !== 'Accepted') {
      Alert.alert(
        'Accept ticket first',
        'Accept this assignment before updating its status.'
      );
      return;
    }

    setSubmitting(true);
    try { await updateTicketStatus(selectedTicket.id, newStatus); }
    catch (error) { showMessage('Could not update ticket', apiMessage(error)); }
    finally { setSubmitting(false); }
  };

  // Logout and return to the Welcome screen.
  const handleLogout = async () => {
    try { await logout(); } catch (error) { showMessage('Sign out failed', apiMessage(error)); }
    navigation.reset({
      index: 0,
      routes: [{ name: 'Welcome' }],
    });
  };

  const tabs = isAgent
    ? ['Dashboard', 'My Tickets', 'Notifications', 'Knowledge Base', 'Performance', 'Profile']
    : ['Dashboard', 'Raise Ticket', 'My Tickets', 'Notifications', 'Knowledge Base', 'Profile'];

  const renderHeader = () => (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>SmartTracker</Text>
        <Text style={styles.roleText}>
          {isAgent ? 'Support Agent Portal' : 'Employee Portal'}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.notificationButton}
        onPress={() => {
          setActiveTab('Notifications');
          markNotificationsRead().catch((error) => showMessage('Could not update notifications', apiMessage(error)));
        }}
      >
        <Text style={styles.notificationIcon}>🔔</Text>
        {unreadCount > 0 && (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderStat = (label, value, color) => (
    <View style={styles.statCard} key={label}>
      <Text style={[styles.statNumber, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const renderDashboard = () => (
    <View>
      <Text style={styles.pageTitle}>
        Hello, {profileName.split(' ')[0]}!
      </Text>
      <Text style={styles.subtitle}>
        {isAgent
          ? 'Here is an overview of your assigned work.'
          : 'Track your requests and get help from your support team.'}
      </Text>

      <View style={styles.statsGrid}>
        {renderStat('Total', myTickets.length, '#253858')}
        {renderStat('Open', countStatus('Open'), '#D97706')}
        {renderStat('In Progress', countStatus('In Progress'), '#2563EB')}
        {renderStat('Resolved', countStatus('Resolved'), GREEN)}
      </View>

      {isAgent && (
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Pending acceptance</Text>
          <Text style={styles.bigNumber}>
            {myTickets.filter((ticket) => ticket.acceptance === 'Pending').length}
          </Text>
          <Text style={styles.subtitle}>
            Tickets waiting for you to accept or reject.
          </Text>
        </View>
      )}

      {!isAgent && (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => setActiveTab('Raise Ticket')}
        >
          <Text style={styles.primaryButtonText}>＋ Raise a New Ticket</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Recent Tickets</Text>
      {myTickets.slice(0, 4).map(renderTicketCard)}
      {myTickets.length === 0 && (
        <Text style={styles.emptyText}>No tickets available yet.</Text>
      )}
    </View>
  );

  const renderTicketCard = (ticket) => (
    <TouchableOpacity
      key={ticket.id}
      style={styles.ticketCard}
      onPress={() => openTicketDetails(ticket.id)}
    >
      <View style={styles.ticketTopRow}>
        <Text style={styles.ticketId}>{ticket.ticketNumber || ticket.id}</Text>
        <Text style={styles.statusBadge}>{ticket.status}</Text>
      </View>

      <Text style={styles.ticketTitle}>{ticket.title}</Text>
      <Text style={styles.ticketDescription} numberOfLines={2}>
        {ticket.description}
      </Text>

      <View style={styles.ticketBottomRow}>
        <Text style={styles.metaText}>Priority: {ticket.priority}</Text>
        <Text style={styles.linkText}>View details →</Text>
      </View>

      {isAgent && ticket.acceptance === 'Pending' && (
        <Text style={styles.pendingText}>Awaiting your acceptance</Text>
      )}
    </TouchableOpacity>
  );

  const renderChoice = (options, selected, onSelect, disabled = false) => (
    <View style={styles.choiceContainer}>
      {options.map((option) => (
        <TouchableOpacity
          key={option}
          style={[
            styles.choiceButton,
            selected === option && styles.choiceSelected,
          ]}
          disabled={disabled}
          onPress={() => onSelect(option)}
        >
          <Text
            style={[
              styles.choiceText,
              selected === option && styles.choiceSelectedText,
            ]}
          >
            {option}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderInput = (label, value, onChangeText, placeholder, multiline = false) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );

  const renderRaiseTicket = () => (
    <View>
      <Text style={styles.pageTitle}>Raise a Ticket</Text>
      <Text style={styles.subtitle}>
        Describe the issue so the support team can help you.
      </Text>

      {renderInput('Ticket Title', title, setTitle, 'Example: Laptop not starting')}
      {renderInput(
        'Description',
        description,
        setDescription,
        'Explain the issue in detail...',
        true
      )}

      <Text style={styles.label}>Category</Text>
      {renderChoice(categories, category, setCategory)}

      <Text style={styles.label}>Priority</Text>
      {renderChoice(priorities, priority, setPriority)}

      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Before submitting</Text>
        <Text style={styles.subtitle}>
          Provide clear details and choose the correct priority. The admin
          or support team will review and assign your ticket.
        </Text>
      </View>

      <TouchableOpacity disabled={submitting} style={styles.primaryButton} onPress={submitTicket}>
        <Text style={styles.primaryButtonText}>Submit Ticket</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMyTickets = () => (
    <View>
      <Text style={styles.pageTitle}>
        {isAgent ? 'My Assigned Tickets' : 'My Tickets'}
      </Text>
      <Text style={styles.subtitle}>
        {isAgent
          ? 'Tickets assigned to your support account.'
          : 'All tickets you have submitted.'}
      </Text>

      {myTickets.length === 0 ? (
        <Text style={styles.emptyText}>No tickets found.</Text>
      ) : (
        myTickets.map(renderTicketCard)
      )}
    </View>
  );

  const renderTicketDetails = () => {
    if (!selectedTicket) {
      return (
        <View>
          <Text style={styles.pageTitle}>Ticket not found</Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setActiveTab('My Tickets')}
          >
            <Text style={styles.secondaryButtonText}>Back to My Tickets</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const visibleComments = selectedTicket.comments || [];
    const privateNotes = selectedTicket.internalNotes || [];

    return (
      <View>
        <TouchableOpacity
          onPress={() => setActiveTab('My Tickets')}
          style={styles.backLink}
        >
          <Text style={styles.linkText}>← Back to tickets</Text>
        </TouchableOpacity>

        <Text style={styles.pageTitle}>{selectedTicket.title}</Text>
        <Text style={styles.ticketId}>{selectedTicket.id}</Text>

        <View style={styles.infoCard}>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Status: </Text>
            {selectedTicket.status}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Priority: </Text>
            {selectedTicket.priority}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Category: </Text>
            {selectedTicket.category}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Created: </Text>
            {selectedTicket.createdAt ? new Date(selectedTicket.createdAt).toLocaleString() : '—'}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Assigned agent: </Text>
            {selectedTicket.agentName || 'Waiting for assignment'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Issue Description</Text>
        <Text style={styles.bodyText}>{selectedTicket.description}</Text>

        {isAgent && (
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Assignment response</Text>
            <Text style={styles.bodyText}>
              {selectedTicket.acceptance || 'Not assigned'}
            </Text>

            {selectedTicket.acceptance === 'Pending' && (
              <>
                <TouchableOpacity
                  style={styles.primaryButton}
                  disabled={submitting}
                  onPress={handleAccept}
                >
                  <Text style={styles.primaryButtonText}>Accept Ticket</Text>
                </TouchableOpacity>

                {renderInput(
                  'Reason for rejection',
                  rejectReason,
                  setRejectReason,
                  'Explain why you cannot take this ticket...',
                  true
                )}

                <TouchableOpacity
                  style={styles.rejectButton}
                  disabled={submitting}
                  onPress={handleReject}
                >
                  <Text style={styles.rejectButtonText}>Reject Assignment</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {isAgent && selectedTicket.acceptance === 'Accepted' && (
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Update Ticket Status</Text>
            {renderChoice(
              statusTransitions[selectedTicket.status] || [],
              selectedTicket.status,
              changeStatus,
              submitting
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>Comments</Text>
        {visibleComments.length === 0 ? (
          <Text style={styles.emptyText}>No comments yet.</Text>
        ) : (
          visibleComments.map((comment) => (
            <View key={comment.id} style={styles.commentCard}>
              <Text style={styles.commentAuthor}>{comment.author}</Text>
              <Text style={styles.bodyText}>{comment.message}</Text>
              <Text style={styles.dateText}>{comment.createdAt}</Text>
            </View>
          ))
        )}

        <Text style={styles.label}>Add a public comment</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          placeholder="Write a reply visible to the other person..."
          placeholderTextColor="#9CA3AF"
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />

        <TouchableOpacity
          style={styles.primaryButton}
          disabled={submitting}
          onPress={submitPublicComment}
        >
          <Text style={styles.primaryButtonText}>Send Comment</Text>
        </TouchableOpacity>

        {isAgent && (
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Internal Notes</Text>
            <Text style={styles.subtitle}>
              These notes are intended for staff only and are not shown in the
              employee's comment list.
            </Text>

            {privateNotes.map((note) => (
              <View key={note.id} style={styles.commentCard}>
                <Text style={styles.commentAuthor}>{note.author} · Internal</Text>
                <Text style={styles.bodyText}>{note.message}</Text>
                <Text style={styles.dateText}>{note.createdAt}</Text>
              </View>
            ))}

            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Add a private internal note..."
              placeholderTextColor="#9CA3AF"
              value={internalNoteText}
              onChangeText={setInternalNoteText}
              multiline
            />

            <TouchableOpacity
              style={styles.secondaryButton}
              disabled={submitting}
              onPress={submitInternalNote}
            >
              <Text style={styles.secondaryButtonText}>Save Internal Note</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderNotifications = () => (
    <View>
      <Text style={styles.pageTitle}>Notifications</Text>
      <Text style={styles.subtitle}>
        Updates related to your tickets and account.
      </Text>

      <TouchableOpacity
        style={styles.secondaryButton}
        disabled={isTicketLoading}
        onPress={() => markNotificationsRead().catch((error) => showMessage('Could not update notifications', apiMessage(error)))}
      >
        <Text style={styles.secondaryButtonText}>Mark all as read</Text>
      </TouchableOpacity>

      {myNotifications.length === 0 ? (
        <Text style={styles.emptyText}>You have no notifications.</Text>
      ) : (
        myNotifications.map((notification) => (
          <TouchableOpacity key={notification.id} style={styles.notificationCard} onPress={() => setNotificationRead(notification.id, !notification.read).catch((error) => showMessage('Could not update notification', apiMessage(error)))}>
            <View style={styles.ticketTopRow}>
              <Text style={styles.cardTitle}>{notification.title}</Text>
              {!notification.read && (
                <Text style={styles.unreadText}>NEW</Text>
              )}
            </View>
            <Text style={styles.bodyText}>{notification.message}</Text>
            <Text style={styles.dateText}>{notification.createdAt}</Text>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderKnowledgeBase = () => (
    <View>
      <Text style={styles.pageTitle}>Knowledge Base</Text>
      <Text style={styles.subtitle}>
        Basic troubleshooting resources.
      </Text>

      <TextInput style={styles.input} placeholder="Search articles" value={knowledgeSearch} onChangeText={setKnowledgeSearch} />

      {knowledgeLoading ? <Text style={styles.emptyText}>Loading articles…</Text> : null}
      {knowledgeError ? <Text style={styles.errorText}>{knowledgeError}</Text> : null}
      {!knowledgeLoading && !knowledgeError && knowledgeArticles.length === 0 ? <Text style={styles.emptyText}>No published articles are available.</Text> : null}
      {knowledgeArticles.map((article) => (
        <View style={styles.infoCard} key={article.id}>
          <Text style={styles.cardTitle}>{article.title}</Text>
          <Text style={styles.bodyText}>{article.content || article.summary}</Text>
          <Text style={styles.dateText}>{article.category}</Text>
        </View>
      ))}
    </View>
  );

  const renderPerformance = () => (
    <View>
      <Text style={styles.pageTitle}>My Performance</Text>
      <Text style={styles.subtitle}>
        A summary of your assigned ticket workload.
      </Text>

      <View style={styles.statsGrid}>
        {renderStat('Assigned', myTickets.length, '#253858')}
        {renderStat('Accepted', myTickets.filter((t) => t.acceptance === 'Accepted').length, '#2563EB')}
        {renderStat('Resolved', countStatus('Resolved'), GREEN)}
        {renderStat('On Hold', countStatus('On Hold'), '#D97706')}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Workload</Text>
        <Text style={styles.bodyText}>
          This summary is based on tickets currently assigned to your account.
        </Text>
      </View>
    </View>
  );

  const renderProfile = () => (
    <View>
      <Text style={styles.pageTitle}>My Profile</Text>

      {renderInput('Full Name', profileName, setProfileName, 'Enter your name')}
      {renderInput('Phone Number', profilePhone, setProfilePhone, 'Enter your phone number')}

      <View style={styles.infoCard}>
        <Text style={styles.label}>Company Email</Text>
        <Text style={styles.bodyText}>{email}</Text>
        <Text style={styles.label}>Role</Text>
        <Text style={styles.bodyText}>
          {isAgent ? 'Support Agent' : 'Employee'}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        disabled={submitting}
        onPress={async () => {
          setSubmitting(true);
          setProfileMessage('');
          try { await updateProfile({ fullName: profileName.trim(), phone: profilePhone.trim() }); setProfileMessage('Profile saved.'); }
          catch (error) { setProfileMessage(apiMessage(error)); }
          finally { setSubmitting(false); }
        }}
      >
        <Text style={styles.primaryButtonText}>Save Profile</Text>
      </TouchableOpacity>
      {profileMessage ? <Text style={profileMessage === 'Profile saved.' ? styles.successText : styles.errorText}>{profileMessage}</Text> : null}
    </View>
  );

  const renderContent = () => {
    if (activeTab === 'Dashboard') return renderDashboard();
    if (activeTab === 'Raise Ticket' && !isAgent) return renderRaiseTicket();
    if (activeTab === 'My Tickets') return renderMyTickets();
    if (activeTab === 'Ticket Details') return renderTicketDetails();
    if (activeTab === 'Notifications') return renderNotifications();
    if (activeTab === 'Knowledge Base') return renderKnowledgeBase();
    if (activeTab === 'Performance' && isAgent) return renderPerformance();
    if (activeTab === 'Profile') return renderProfile();

    return renderDashboard();
  };

  return (
    <View style={styles.container}>
      {renderHeader()}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabContainer}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => {
              setActiveTab(tab);
          if (tab === 'Notifications') markNotificationsRead().catch((error) => showMessage('Could not update notifications', apiMessage(error)));
            }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {isTicketLoading ? <Text style={styles.emptyText}>Loading your workspace…</Text> : null}
        {ticketError ? <Text style={styles.errorText}>{apiMessage(ticketError)}</Text> : null}
        {renderContent()}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF3',
  },
  brand: {
    fontSize: 21,
    fontWeight: '800',
    color: GREEN,
  },
  roleText: {
    fontSize: 12,
    color: '#718096',
    marginTop: 3,
  },
  notificationButton: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: '#E8F7EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationIcon: {
    fontSize: 20,
  },
  notificationBadge: {
    position: 'absolute',
    right: -4,
    top: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DC3545',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  tabScroll: {
    maxHeight: 58,
    backgroundColor: '#FFFFFF',
  },
  tabContainer: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  tab: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F2F4F8',
  },
  activeTab: {
    backgroundColor: GREEN,
  },
  tabText: {
    fontSize: 12,
    color: '#526078',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 18,
    paddingBottom: 35,
  },
  pageTitle: {
    color: '#17233D',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 7,
  },
  subtitle: {
    color: '#718096',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 17,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EDF0F5',
  },
  statNumber: {
    fontSize: 25,
    fontWeight: '800',
  },
  statLabel: {
    color: '#718096',
    fontSize: 12,
    marginTop: 5,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 17,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EDF0F5',
  },
  cardTitle: {
    color: '#253858',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  bigNumber: {
    fontSize: 30,
    fontWeight: '800',
    color: GREEN,
  },
  sectionTitle: {
    color: '#17233D',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 12,
  },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9EDF4',
  },
  ticketTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketId: {
    color: GREEN,
    fontSize: 12,
    fontWeight: '800',
  },
  statusBadge: {
    color: '#245A46',
    backgroundColor: '#E8F7EF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: '700',
  },
  ticketTitle: {
    color: '#17233D',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  ticketDescription: {
    color: '#718096',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  ticketBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 13,
  },
  metaText: {
    color: '#718096',
    fontSize: 11,
  },
  linkText: {
    color: GREEN,
    fontSize: 12,
    fontWeight: '700',
  },
  pendingText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
  },
  primaryButton: {
    minHeight: 50,
    backgroundColor: GREEN,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginTop: 12,
    marginBottom: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginTop: 10,
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: GREEN,
    fontSize: 13,
    fontWeight: '700',
  },
  rejectButton: {
    minHeight: 48,
    backgroundColor: '#FDECEC',
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  rejectButtonText: {
    color: '#B42318',
    fontSize: 14,
    fontWeight: '800',
  },
  field: {
    marginBottom: 17,
  },
  label: {
    color: '#27344D',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    minHeight: 49,
    borderWidth: 1,
    borderColor: '#E1E6EF',
    borderRadius: 11,
    paddingHorizontal: 13,
    color: '#17233D',
    backgroundColor: '#FFFFFF',
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 105,
    paddingTop: 13,
    marginBottom: 13,
  },
  choiceContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 17,
    marginTop: 5,
  },
  choiceButton: {
    borderWidth: 1,
    borderColor: '#DCE2EB',
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  choiceSelected: {
    borderColor: GREEN,
    backgroundColor: '#E8F7EF',
  },
  choiceText: {
    color: '#526078',
    fontSize: 12,
    fontWeight: '600',
  },
  choiceSelectedText: {
    color: GREEN,
    fontWeight: '800',
  },
  detailText: {
    color: '#526078',
    fontSize: 13,
    marginBottom: 10,
  },
  detailLabel: {
    color: '#253858',
    fontWeight: '800',
  },
  bodyText: {
    color: '#526078',
    fontSize: 13,
    lineHeight: 20,
  },
  commentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E9EDF4',
  },
  commentAuthor: {
    color: GREEN,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  dateText: {
    color: '#9AA4B5',
    fontSize: 10,
    marginTop: 8,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    padding: 15,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: '#E9EDF4',
  },
  unreadText: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: '800',
  },
  emptyText: {
    color: '#8A94A6',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 25,
  },
  errorText: { color: '#B42318', fontSize: 13, marginVertical: 10 },
  successText: { color: GREEN, fontSize: 13, marginVertical: 10 },
  backLink: {
    marginBottom: 16,
  },
  logoutButton: {
    marginTop: 24,
    borderRadius: 11,
    backgroundColor: '#FDECEC',
    padding: 15,
    alignItems: 'center',
  },
  logoutText: {
    color: '#B42318',
    fontWeight: '800',
    fontSize: 14,
  },
});
