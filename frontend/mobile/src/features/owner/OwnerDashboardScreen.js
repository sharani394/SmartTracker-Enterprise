
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { organisationService } from '../../services/organisationService';
import { reportService } from '../../services/reportService';
import { apiMessage } from '../../utils/feedback';
import { showMessage } from '../../utils/feedback';

const menuItems = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'organisation', label: 'Organisation', icon: '🏢' },
  { id: 'admins', label: 'Administrators', icon: '🛡️' },
  { id: 'people', label: 'People', icon: '👥' },
  { id: 'reports', label: 'Reports & Analytics', icon: '📊' },
  { id: 'security', label: 'Security & Access', icon: '🔐' },
  { id: 'activity', label: 'Activity Logs', icon: '📋' },
  { id: 'settings', label: 'Owner Settings', icon: '⚙️' },
];

function SectionHeading({ title, subtitle }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

function formatStatus(status) {
  return status.replaceAll('_', ' ').toLowerCase();
}

function StatCard({ item }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: item.bg }]}>
        <Text style={styles.statIconText}>{item.icon}</Text>
      </View>
      <Text style={styles.statValue}>{item.value}</Text>
      <Text style={styles.statLabel}>{item.label}</Text>
      <Text style={styles.statChange}>{item.change}</Text>
    </View>
  );
}

export default function OwnerDashboardScreen({ navigation }) {
  const { user, organisation, logout, updateOrganisationSettings, issuePrimaryAdminCode } = useAuth();
  const [activeSection, setActiveSection] = useState('overview');
  const [employees, setEmployees] = useState([]); const [agents, setAgents] = useState([]); const [pendingMembers, setPendingMembers] = useState([]); const [internalAdmins, setInternalAdmins] = useState([]);
  const [primaryAdmin, setPrimaryAdmin] = useState(undefined);
  const [ownerReport, setOwnerReport] = useState(null); const [dashboardError, setDashboardError] = useState('');
  const [orgForm, setOrgForm] = useState({ name: '', industry: '', country: '', supportEmail: '', timezone: '' });
  const [code, setCode] = useState(null); const [currentPassword, setCurrentPassword] = useState(''); const [replaceAdmin, setReplaceAdmin] = useState(false);
  const [loading, setLoading] = useState(false); const [savingOrg, setSavingOrg] = useState(false);
  const refreshOwnerData = async () => {
    setLoading(true); setDashboardError('');
    const results = await Promise.allSettled([
      organisationService.listUsers({ role: 'EMPLOYEE' }),
      organisationService.listUsers({ role: 'SUPPORT_AGENT' }),
      organisationService.listPendingMembers(),
      organisationService.listInternalAdmins(),
      organisationService.getPrimaryAdmin(),
      organisationService.getSettings(),
      reportService.summary(),
    ]);
    if (results[0].status === 'fulfilled') setEmployees(results[0].value.users || []);
    if (results[1].status === 'fulfilled') setAgents(results[1].value.users || []);
    if (results[2].status === 'fulfilled') setPendingMembers(results[2].value.members || []);
    if (results[3].status === 'fulfilled') setInternalAdmins(results[3].value.internalAdmins || []);
    if (results[4].status === 'fulfilled') setPrimaryAdmin(results[4].value.primaryAdmin || null);
    if (results[5].status === 'fulfilled') { const org = results[5].value.organisation; setOrgForm({ name: org.name || '', industry: org.industry || '', country: org.country || '', supportEmail: org.settings?.supportEmail || '', timezone: org.settings?.timezone || '' }); }
    if (results[6].status === 'fulfilled') setOwnerReport(results[6].value);
    const failed = results.find((item) => item.status === 'rejected'); if (failed) setDashboardError(apiMessage(failed.reason));
    setLoading(false);
  };
  useEffect(() => { refreshOwnerData(); }, [user?.id]);
  const ownerStats = [
    { label: 'Total Employees', value: employees.length, change: 'Organisation members', icon: '👥', color: '#3157D5', bg: '#EAF0FF' },
    { label: 'Support Agents', value: agents.length, change: 'Registered agents', icon: '🎧', color: '#16845B', bg: '#E8F7EF' },
    { label: 'Internal Admins', value: internalAdmins.length, change: 'Delegated administration', icon: '🛡️', color: '#A45E12', bg: '#FFF3E5' },
    { label: 'Pending Approvals', value: pendingMembers.length, change: 'Awaiting admin action', icon: '⏳', color: '#9B51C6', bg: '#F5EAFE' },
  ];

  // Overview
  const renderOverview = () => (
    <>
      <SectionHeading
        title="Organisation Overview"
        subtitle="Here's what's happening in your workspace."
      />

      <View style={styles.statsGrid}>
        {ownerStats.map((item) => (
          <StatCard key={item.label} item={item} />
        ))}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Administrator Setup</Text>
        <Text style={styles.panelDescription}>
          Manage the administrators responsible for your organisation.
        </Text>

        <View style={styles.adminStatus}>
          <View style={[styles.statusDot, { backgroundColor: primaryAdmin?.status === 'ACTIVE' ? '#16845B' : primaryAdmin === null ? '#98A2B3' : '#D58A21' }]} />
          <View style={styles.adminStatusText}>
            <Text style={styles.adminStatusTitle}>{primaryAdmin?.fullName || 'Primary Admin'}</Text>
            <Text style={styles.mutedText}>
              {primaryAdmin === undefined
                ? 'Loading administrator details…'
                : primaryAdmin
                  ? `${primaryAdmin.email} · ${formatStatus(primaryAdmin.status)}`
                  : 'No Primary Admin has been appointed yet.'}
            </Text>
          </View>
          {primaryAdmin === undefined ? <Text style={styles.mutedText}>Loading</Text> : (
            <Text style={[
              styles.accountStatus,
              primaryAdmin ? primaryAdmin.status === 'ACTIVE' ? styles.accountStatusActive : styles.accountStatusPending : styles.accountStatusNeutral,
            ]}>
              {primaryAdmin ? formatStatus(primaryAdmin.status) : 'Not appointed'}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => setActiveSection('admins')}
        >
          <Text style={styles.primaryButtonText}>
            Manage Administrators →
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Organisation Health</Text>
        <Text style={styles.panelDescription}>
          A high-level view of your workspace activity.
        </Text>

        <View style={styles.healthRow}>
          <Text style={styles.healthLabel}>Active employees</Text>
          <Text style={styles.healthValue}>{employees.filter((item) => item.status === 'ACTIVE').length}</Text>
        </View>
        <View style={styles.progressBackground}>
          <View style={[styles.progressFill, { width: `${Math.min(100, employees.length ? employees.filter((item) => item.status === 'ACTIVE').length / employees.length * 100 : 0)}%` }]} />
        </View>

        <View style={styles.healthRow}>
          <Text style={styles.healthLabel}>Active support agents</Text>
          <Text style={styles.healthValue}>{agents.filter((item) => item.status === 'ACTIVE').length}</Text>
        </View>
        <View style={styles.progressBackground}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, agents.length ? agents.filter((item) => item.status === 'ACTIVE').length / agents.length * 100 : 0)}%`, backgroundColor: '#16845B' },
            ]}
          />
        </View>

        <Text style={styles.smallNote}>
          {loading ? 'Loading organisation data…' : `Ticket count in current report range: ${ownerReport?.totals?.tickets ?? '—'}.`}
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Quick Actions</Text>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => setActiveSection('admins')}
        >
          <Text style={styles.actionIcon}>🛡️</Text>
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitle}>Manage Administrators</Text>
            <Text style={styles.mutedText}>
              Appoint or manage admin access
            </Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => setActiveSection('organisation')}
        >
          <Text style={styles.actionIcon}>🏢</Text>
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitle}>Organisation Profile</Text>
            <Text style={styles.mutedText}>
              Review company information
            </Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => navigation.navigate('OwnerReports')}
        >
          <Text style={styles.actionIcon}>📊</Text>
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitle}>View Reports</Text>
            <Text style={styles.mutedText}>
              Monitor organisation performance
            </Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // Administrator Management
  const renderAdmins = () => (
    <>
      <SectionHeading
        title="Administrator Management"
        subtitle="Control who has administrative access to your organisation."
      />

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Primary Administrator</Text>
        <Text style={styles.panelDescription}>
          The Primary Admin manages daily operations, users, approvals and tickets.
        </Text>

        <View style={styles.personRow}>
          <View style={[styles.avatar, { backgroundColor: '#EAF0FF' }]}>
            <Text style={styles.avatarText}>PA</Text>
          </View>
          <View style={styles.personInfo}>
            <Text style={styles.personName}>{primaryAdmin?.fullName || 'Primary Admin'}</Text>
            <Text style={styles.mutedText}>
              {primaryAdmin === undefined
                ? 'Loading administrator details…'
                : primaryAdmin
                  ? `${primaryAdmin.email} · ${formatStatus(primaryAdmin.status)}`
                  : 'No Primary Admin has been appointed yet.'}
            </Text>
          </View>
          {primaryAdmin === undefined ? <Text style={styles.mutedText}>Loading</Text> : (
            <Text style={[
              styles.accountStatus,
              primaryAdmin ? primaryAdmin.status === 'ACTIVE' ? styles.accountStatusActive : styles.accountStatusPending : styles.accountStatusNeutral,
            ]}>
              {primaryAdmin ? formatStatus(primaryAdmin.status) : 'Not appointed'}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Internal Administrators</Text>
        <Text style={styles.panelDescription}>
          Internal Admins receive only the permissions delegated by the Primary Admin.
        </Text>

        {internalAdmins.map((admin) => (
          <View style={styles.personRow} key={admin.id}>
            <View style={[styles.avatar, { backgroundColor: '#E8F7EF' }]}>
              <Text style={styles.avatarText}>IA</Text>
            </View>
            <View style={styles.personInfo}>
              <Text style={styles.personName}>{admin.fullName}</Text>
              <Text style={styles.mutedText}>{admin.email} · {(admin.permissions || []).length} permissions</Text>
            </View>
            <Text style={[
              styles.accountStatus,
              admin.status === 'ACTIVE' ? styles.accountStatusActive : styles.accountStatusPending,
            ]}>
              {formatStatus(admin.status)}
            </Text>
          </View>
        ))}
        {!internalAdmins.length ? <Text style={styles.smallNote}>No Internal Admin accounts.</Text> : null}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Primary Admin Appointment</Text>
        <Text style={styles.panelDescription}>
          Generate a secure one-time code to appoint a Primary Admin. If one is already appointed, you can replace them after confirming your Owner password.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={async () => {
            if (primaryAdmin && !replaceAdmin) {
              setReplaceAdmin(true);
              return;
            }
            try { const result = await issuePrimaryAdminCode(replaceAdmin ? { replaceCurrent: true, currentPassword } : {}); setCode(result); setCurrentPassword(''); setReplaceAdmin(false); }
            catch (error) {
              if (error.status === 409 && !replaceAdmin) setReplaceAdmin(true);
              else showMessage('Could not generate admin code', apiMessage(error));
            }
          }}
        >
          <Text style={styles.primaryButtonText}>
            {replaceAdmin
              ? 'Confirm & Generate Replacement Code'
              : primaryAdmin
                ? 'Replace Primary Admin'
                : 'Generate Admin Registration Code'}
          </Text>
        </TouchableOpacity>

        {replaceAdmin ? (
          <View style={styles.inputField}>
            <Text style={styles.inputLabel}>Current Owner Password</Text>
            <TextInput
              style={styles.orgInput}
              placeholder="Enter your current password"
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              autoCapitalize="none"
              accessibilityLabel="Current Owner Password"
            />
            <Text style={styles.inputHelp}>Password confirmation is required to replace the current Primary Admin.</Text>
            <TouchableOpacity
              style={styles.cancelReplacementButton}
              onPress={() => { setReplaceAdmin(false); setCurrentPassword(''); }}
              accessibilityRole="button"
              accessibilityLabel="Cancel Primary Admin replacement"
            >
              <Text style={styles.cancelReplacementText}>Cancel replacement</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {code ? <View><Text style={styles.codeValue}>Registration code: {code.code}</Text><Text style={styles.smallNote}>Expires: {new Date(code.expiresAt).toLocaleString()}. This one-time code is shown only now; share it with the applicant securely.</Text></View> : null}
      </View>

      <Text style={styles.smallNote}>Permission editing is available to Primary Admins in the Admin Portal.</Text>
    </>
  );

  // Organisation Profile
  const renderOrganisation = () => (
    <>
      <SectionHeading
        title="Organisation Profile"
        subtitle="Manage your organisation's identity and workspace information."
      />

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Company Information</Text>

        {[
          ['Organisation Name', orgForm.name], ['Official Email Domain', organisation?.emailDomain || '—'],
          ['Industry', orgForm.industry], ['Country', orgForm.country],
        ].map(([label, value]) => <View style={styles.detailRow} key={label}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || '—'}</Text></View>)}
        <View style={styles.statusDetail}>
          <Text style={styles.detailLabel}>Workspace Status</Text>
          <Text style={[
            styles.statusBadge,
            organisation?.status === 'ACTIVE' ? styles.statusBadgeActive : styles.statusBadgeOther,
          ]}>
            {(organisation?.status || 'UNKNOWN').replaceAll('_', ' ')}
          </Text>
          <Text style={styles.statusHelp}>
            {organisation?.status === 'ACTIVE'
              ? 'Your workspace is active. Approved members can sign in and use SmartTracker.'
              : organisation?.status === 'PENDING_VERIFICATION'
                ? 'Your workspace is waiting for email verification before members can use it.'
                : organisation?.status === 'SUSPENDED'
                  ? 'Workspace access is suspended, so members cannot sign in.'
                  : 'Workspace status is currently unavailable.'}
          </Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Update Organisation Details</Text>
        <Text style={styles.panelDescription}>These fields update your organisation profile. The official email domain and workspace status are managed separately.</Text>
        {[
          ['Organisation Name', 'name'],
          ['Industry', 'industry'],
          ['Country', 'country'],
          ['Support Email', 'supportEmail'],
          ['Timezone', 'timezone'],
        ].map(([label, field]) => (
          <View key={field} style={styles.inputField}>
            <Text style={styles.inputLabel}>{label}</Text>
            <TextInput
              style={styles.orgInput}
              placeholder={field === 'timezone' ? 'e.g. Asia/Kolkata' : `Enter ${label.toLowerCase()}`}
              value={orgForm[field]}
              onChangeText={(value) => setOrgForm((previous) => ({ ...previous, [field]: value }))}
              autoCapitalize="none"
              accessibilityLabel={label}
            />
            {field === 'timezone' ? <Text style={styles.inputHelp}>Use an IANA timezone, such as Asia/Kolkata or UTC.</Text> : null}
          </View>
        ))}

        <TouchableOpacity
          style={styles.primaryButton}
          disabled={savingOrg}
          onPress={async () => {
            setSavingOrg(true);
            try { const changes = Object.fromEntries(Object.entries(orgForm).filter(([key, value]) => ['name', 'industry', 'country'].includes(key) || value.trim())); await updateOrganisationSettings(changes); await refreshOwnerData(); }
            catch (error) { showMessage('Could not update organisation', apiMessage(error)); }
            finally { setSavingOrg(false); }
          }}
        >
          <Text style={styles.primaryButtonText}>
            {savingOrg ? 'Saving…' : 'Save Organisation Details'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Verified Email Domains</Text>
        <Text style={styles.panelDescription}>
          Only verified company domains should be allowed for member registration.
        </Text>
        <Text style={styles.smallNote}>
          Domain verification will use an email or DNS verification process.
        </Text>

        <Text style={styles.smallNote}>Domain membership is checked by the backend during registration. Domain changes require a separate verification workflow.</Text>
      </View>
    </>
  );

  // People Overview
  const renderPeople = () => (
    <>
      <SectionHeading
        title="People Overview"
        subtitle="Review the workforce registered in your organisation."
      />

      <View style={styles.statsGrid}>
        <StatCard item={ownerStats[0]} />
        <StatCard item={ownerStats[1]} />
        <StatCard
          item={{
            label: 'Pending Members',
            value: pendingMembers.length,
            change: 'Awaiting approval',
            icon: '⏳',
            color: '#9B51C6',
            bg: '#F5EAFE',
          }}
        />
        <StatCard
          item={{
            label: 'Suspended Accounts',
            value: employees.filter((item) => item.status === 'SUSPENDED').length + agents.filter((item) => item.status === 'SUSPENDED').length,
            change: 'Access restricted',
            icon: '🚫',
            color: '#C0392B',
            bg: '#FCEAEA',
          }}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Workforce Management</Text>
        <Text style={styles.panelDescription}>
          Daily member registration approvals and employee management belong to your Primary Admin.
          You can monitor the organisation-level workforce here.
        </Text>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('OwnerReports')}
        >
          <Text style={styles.secondaryButtonText}>
            View Workforce Report
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // Owner Settings only
  const sectionDetails = {
    settings: {
      title: 'Owner Settings',
      subtitle: 'Manage your personal account and preferences.',
      cards: [
        ['Owner Profile', 'Update your name and contact information.'],
        ['Password & Security', 'Manage your account security.'],
        ['Notifications', 'Configure owner notifications.'],
        ['Help & Support', 'Get help with your SmartTracker workspace.'],
      ],
    },
  };

  // Owner Settings navigation
  const renderGenericSection = (section) => {
    const details = sectionDetails[section];

    if (!details) return null;

    return (
      <>
        <SectionHeading
          title={details.title}
          subtitle={details.subtitle}
        />

        {details.cards.map(([title, description]) => (
          <TouchableOpacity
            style={styles.featureCard}
            key={title}
            activeOpacity={0.7}
            onPress={() => {
              switch (title) {
                case 'Owner Profile':
                  navigation.navigate('OwnerProfile');
                  break;

                case 'Password & Security':
                  navigation.navigate('OwnerSecurity');
                  break;

                case 'Notifications':
                  navigation.navigate('OwnerNotifications');
                  break;

                case 'Help & Support':
                  navigation.navigate('OwnerHelp');
                  break;

                default:
                  break;
              }
            }}
          >
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{title}</Text>
              <Text style={styles.featureDescription}>
                {description}
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </>
    );
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return renderOverview();

      case 'organisation':
        return renderOrganisation();

      case 'admins':
        return renderAdmins();

      case 'people':
        return renderPeople();

      case 'settings':
        return renderGenericSection('settings');

      default:
        return renderOverview();
    }
  };

  // Sign out confirmation
  const completeSignOut = async () => { try { await logout(); } catch { showMessage('Signed out locally', 'The server could not confirm session revocation.'); } navigation.replace('Welcome'); };
  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Are you sure you want to sign out?'
      );

      if (confirmed) {
        completeSignOut();
      }
    } else {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: completeSignOut,
          },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.brandContainer}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>ST</Text>
          </View>
          <View>
            <Text style={styles.brandName}>SmartTracker</Text>
            <Text style={styles.brandSubtitle}>OWNER PORTAL</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('OwnerProfile')}
            accessibilityRole="button"
            accessibilityLabel="Open owner profile"
          >
            <Text style={styles.profileInitial}>{user?.fullName?.trim()?.[0]?.toUpperCase() || 'O'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.welcomeBanner}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcomeLabel}>ORGANISATION OWNER</Text>
          <Text style={styles.welcomeTitle}>Welcome back{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}!</Text>
          <Text style={styles.welcomeDescription}>
            Manage your workspace from one place.
          </Text>
        </View>
        <Text style={styles.welcomeIcon}>🏢</Text>
      </View>

      <View style={styles.navigationContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.navigationContent}
        >
          {menuItems.map((item) => {
            const selected = activeSection === item.id;

            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => {
                  if (item.id === 'reports') {
                    navigation.navigate('OwnerReports');
                  } else if (item.id === 'security') {
                    navigation.navigate('OwnerAccess');
                  } else if (item.id === 'activity') {
                    navigation.navigate('OwnerActivity');
                  } else {
                    setActiveSection(item.id);
                  }
                }}
                style={[
                  styles.navItem,
                  selected && styles.navItemActive,
                ]}
              >
                <Text style={styles.navIcon}>{item.icon}</Text>
                <Text
                  style={[
                    styles.navLabel,
                    selected && styles.navLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#3157D5" />
            <Text style={styles.loadingText}>Refreshing your workspace…</Text>
          </View>
        ) : null}
        {dashboardError ? (
          <View style={styles.errorBanner}>
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>Some organisation data could not be loaded</Text>
              <Text style={styles.errorMessage}>{dashboardError}</Text>
            </View>
            <TouchableOpacity
              onPress={refreshOwnerData}
              disabled={loading}
              style={styles.retryButton}
              accessibilityRole="button"
              accessibilityLabel="Retry loading organisation data"
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {renderContent()}

        <Text style={styles.footer}>
          SmartTracker · Organisation Owner Portal
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FC',
  },
  topBar: {
    minHeight: 70,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#EAEFF5',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    fontSize: 17,
    fontWeight: '800',
  },
  brandName: {
    color: '#17233D',
    fontSize: 17,
    fontWeight: '800',
  },
  brandSubtitle: {
    color: '#7C879A',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.3,
    marginTop: 2,
  },
  profileButton: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: '#EAF0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    color: '#3157D5',
    fontSize: 16,
    fontWeight: '800',
  },
  welcomeBanner: {
    backgroundColor: '#263F91',
    margin: 16,
    width: '96%',
    maxWidth: 1120,
    alignSelf: 'center',
    borderRadius: 17,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  welcomeLabel: {
    color: '#BFCDFB',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  welcomeTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  welcomeDescription: {
    color: '#DCE5FF',
    fontSize: 12,
    marginTop: 6,
  },
  welcomeIcon: {
    fontSize: 42,
    marginLeft: 10,
  },
  navigationContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EAEFF5',
  },
  navigationContent: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 7,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: '#F5F7FC',
    gap: 7,
  },
  navItemActive: {
    backgroundColor: '#EAF0FF',
  },
  navIcon: {
    fontSize: 14,
  },
  navLabel: {
    color: '#68758B',
    fontSize: 12,
    fontWeight: '600',
  },
  navLabelActive: {
    color: '#3157D5',
    fontWeight: '800',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 30,
    width: '100%',
    maxWidth: 1152,
    alignSelf: 'center',
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, gap: 9 },
  loadingText: { color: '#68758B', fontSize: 12 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF1F0', borderWidth: 1, borderColor: '#F6D0CC', borderRadius: 10, padding: 12, marginBottom: 14, gap: 12 },
  errorCopy: { flex: 1 },
  errorTitle: { color: '#9F2D25', fontSize: 12, fontWeight: '800' },
  errorMessage: { color: '#85423D', fontSize: 11, lineHeight: 16, marginTop: 4 },
  retryButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7B8B3', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  retryText: { color: '#9F2D25', fontSize: 11, fontWeight: '800' },
  sectionHeading: {
    marginBottom: 18,
  },
  sectionTitle: {
    color: '#17233D',
    fontSize: 21,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: '#788499',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 11,
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: 135,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EAEFF5',
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },
  statIconText: {
    fontSize: 16,
  },
  statValue: {
    color: '#17233D',
    fontSize: 25,
    fontWeight: '800',
  },
  statLabel: {
    color: '#34415A',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  statChange: {
    color: '#8792A5',
    fontSize: 10,
    marginTop: 6,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 17,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#EAEFF5',
  },
  panelTitle: {
    color: '#17233D',
    fontSize: 15,
    fontWeight: '800',
  },
  panelDescription: {
    color: '#7B8799',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 15,
  },
  adminStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EEF1F6',
    marginBottom: 15,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#16845B',
    marginRight: 10,
  },
  adminStatusText: {
    flex: 1,
  },
  adminStatusTitle: {
    color: '#26344D',
    fontSize: 13,
    fontWeight: '700',
  },
  accountStatus: {
    overflow: 'hidden',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  accountStatusActive: {
    color: '#126B49',
    backgroundColor: '#E8F7EF',
  },
  accountStatusPending: {
    color: '#8B5A12',
    backgroundColor: '#FFF3E5',
  },
  accountStatusNeutral: {
    color: '#657187',
    backgroundColor: '#F0F2F6',
  },
  cancelReplacementButton: {
    alignSelf: 'flex-start',
    paddingVertical: 9,
  },
  cancelReplacementText: {
    color: '#68758B',
    fontSize: 11,
    fontWeight: '700',
  },
  mutedText: {
    color: '#8994A5',
    fontSize: 11,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: '#3157D5',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#DCE3F0',
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#3157D5',
    fontSize: 12,
    fontWeight: '700',
  },
  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    marginBottom: 8,
  },
  healthLabel: {
    color: '#526078',
    fontSize: 12,
  },
  healthValue: {
    color: '#17233D',
    fontSize: 12,
    fontWeight: '800',
  },
  progressBackground: {
    height: 7,
    backgroundColor: '#EDF0F6',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3157D5',
    borderRadius: 5,
  },
  smallNote: {
    color: '#929CAE',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 13,
  },
  orgInput: { minHeight: 44, borderWidth: 1, borderColor: '#DDE4EF', borderRadius: 9, paddingHorizontal: 12, color: '#27344D', marginTop: 6, backgroundColor: '#FFFFFF' },
  inputField: { marginTop: 13 },
  inputLabel: { color: '#526078', fontSize: 12, fontWeight: '700' },
  inputHelp: { color: '#8792A5', fontSize: 10, lineHeight: 15, marginTop: 5 },
  codeValue: { color: '#16845B', fontSize: 18, fontWeight: '800', marginTop: 12 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F6',
  },
  actionIcon: {
    fontSize: 21,
    marginRight: 13,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    color: '#27344D',
    fontSize: 13,
    fontWeight: '700',
  },
  arrow: {
    color: '#8490A3',
    fontSize: 25,
  },
  detailRow: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F6',
  },
  detailLabel: {
    color: '#8490A3',
    fontSize: 11,
  },
  detailValue: {
    color: '#27344D',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
  },
  statusDetail: {
    paddingTop: 13,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginTop: 6,
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadgeActive: {
    color: '#126B49',
    backgroundColor: '#E8F7EF',
  },
  statusBadgeOther: {
    color: '#8B5A12',
    backgroundColor: '#FFF3E5',
  },
  statusHelp: {
    color: '#788499',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 7,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F6',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  avatarText: {
    color: '#3157D5',
    fontSize: 12,
    fontWeight: '800',
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    color: '#27344D',
    fontSize: 13,
    fontWeight: '700',
  },
  featureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    padding: 17,
    marginBottom: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    color: '#27344D',
    fontSize: 14,
    fontWeight: '800',
  },
  featureDescription: {
    color: '#8792A5',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  signOutButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F0D5D5',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  signOutText: {
    color: '#C0392B',
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    textAlign: 'center',
    color: '#A1AABA',
    fontSize: 10,
    marginTop: 20,
  },
});
