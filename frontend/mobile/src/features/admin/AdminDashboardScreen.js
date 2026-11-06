
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTickets } from '../../context/TicketContext';
import { organisationService } from '../../services/organisationService';
import { reportService } from '../../services/reportService';
import { auditService } from '../../services/auditService';
import { knowledgeBaseService } from '../../services/knowledgeBaseService';
import { apiMessage, showMessage } from '../../utils/feedback';

const menuItems = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'tickets', label: 'Tickets', icon: '🎫' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'agents', label: 'Support Agents', icon: '🎧' },
  { id: 'admins', label: 'Internal Admins', icon: '🛡️' },
  { id: 'departments', label: 'Departments', icon: '🏢' },
  { id: 'reports', label: 'Reports', icon: '📊' },
  { id: 'activity', label: 'Activity Logs', icon: '📋' },
  { id: 'knowledge', label: 'Knowledge Base', icon: '📚' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

const permissionsList = [
  { id: 'tickets:read', label: 'View Tickets' }, { id: 'tickets:manage', label: 'Manage Tickets' },
  { id: 'users:read', label: 'View Users' }, { id: 'users:manage', label: 'Manage Users' },
  { id: 'agents:read', label: 'View Support Agents' }, { id: 'agents:manage', label: 'Manage Support Agents' },
  { id: 'departments:read', label: 'View Departments' }, { id: 'departments:manage', label: 'Manage Departments' },
  { id: 'reports:read', label: 'View Reports' }, { id: 'knowledge:read', label: 'View Knowledge Base' },
  { id: 'knowledge:manage', label: 'Manage Knowledge Base' }, { id: 'audit:read', label: 'View Activity Logs' },
];
const adminStatusTransitions = { Open: ['Resolved'], Assigned: ['Open'], 'In Progress': ['On Hold', 'Resolved', 'Open'], 'On Hold': ['In Progress', 'Resolved', 'Open'], Resolved: ['Open'] };

function SectionHeading({ title, subtitle }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.headingTitle}>{title}</Text>
      <Text style={styles.headingSubtitle}>{subtitle}</Text>
    </View>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({ title, onPress, secondary = false }) {
  return (
    <TouchableOpacity
      style={secondary ? styles.secondaryButton : styles.primaryButton}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={secondary ? styles.secondaryButtonText : styles.primaryButtonText}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default function AdminDashboardScreen({ navigation }) {
  const { logout, user } = useAuth();
  const ticketContext = useTickets();
  const [activeSection, setActiveSection] = useState('overview');
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [articles, setArticles] = useState([]);
  const [activities, setActivities] = useState([]);
  const [report, setReport] = useState(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const [ticketSearch, setTicketSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [ticketFilter, setTicketFilter] = useState('All');
  const [userFilter, setUserFilter] = useState('All');
  const [activityFilter, setActivityFilter] = useState('All');

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [newAdminPermissions, setNewAdminPermissions] = useState(['tickets:read']);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [newAgentDepartment, setNewAgentDepartment] = useState('IT Support');
  const [newDepartment, setNewDepartment] = useState('');
  const [editingDepartmentId, setEditingDepartmentId] = useState(null);
  const [newArticleTitle, setNewArticleTitle] = useState('');
  const [newArticleCategory, setNewArticleCategory] = useState('');
  const [newArticleContent, setNewArticleContent] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState(null);

  const [ticketNote, setTicketNote] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('Medium');
  const [selectedStatus, setSelectedStatus] = useState('Open');


  const notify = (title, message) => {
    showMessage(title, message);
  };

  const toUserCard = (person) => ({ ...person, name: person.fullName, status: ({ PENDING_APPROVAL: 'Pending', ACTIVE: 'Active', SUSPENDED: 'Inactive', REJECTED: 'Rejected', PENDING_EMAIL: 'Pending Email' })[person.status] || person.status, role: (person.requestedRole || person.role) === 'SUPPORT_AGENT' ? 'Support Agent' : 'Employee' });
  const loadOperations = async () => {
    setPageLoading(true); setApiError('');
    try {
      const permission = new Set([user?.role === 'PRIMARY_ADMIN' ? 'all' : '', ...(user?.permissions || [])]);
      const can = (slug) => permission.has('all') || permission.has(slug);
      const tasks = [
        can('tickets:read') ? ticketContext.refreshTickets() : Promise.resolve(null),
        can('users:read') ? organisationService.listUsers({ role: 'EMPLOYEE' }) : Promise.resolve(null),
        can('agents:read') ? organisationService.listUsers({ role: 'SUPPORT_AGENT' }) : Promise.resolve(null),
        user?.role === 'PRIMARY_ADMIN' ? organisationService.listPendingMembers() : Promise.resolve(null),
        user?.role === 'PRIMARY_ADMIN' ? organisationService.listInternalAdmins() : Promise.resolve(null),
        can('departments:read') ? organisationService.listDepartments('ALL') : Promise.resolve(null),
        can('knowledge:read') || can('knowledge:manage') ? knowledgeBaseService.list({ page: 1, limit: 100 }) : Promise.resolve(null),
        can('audit:read') ? auditService.list({ limit: 100 }) : Promise.resolve(null),
        can('reports:read') ? reportService.summary() : Promise.resolve(null),
      ];
      const results = await Promise.allSettled(tasks);
      const [ticketResult, employeeResult, agentResult, pendingResult, adminResult, departmentResult, articleResult, auditResult, reportResult] = results;
      if (ticketResult.status === 'fulfilled' && ticketResult.value) setTickets(ticketResult.value);
      if (employeeResult.status === 'fulfilled' && employeeResult.value) setUsers(employeeResult.value.users.map(toUserCard));
      if (pendingResult.status === 'fulfilled' && pendingResult.value) setUsers((previous) => [...previous.filter((item) => item.status !== 'Pending'), ...pendingResult.value.members.map(toUserCard)]);
      if (agentResult.status === 'fulfilled' && agentResult.value) setAgents(agentResult.value.users.map((item) => ({ ...toUserCard(item), assigned: 0 })));
      if (adminResult.status === 'fulfilled' && adminResult.value) setAdmins((adminResult.value.internalAdmins || []).map((item) => ({ ...item, name: item.fullName, status: item.status === 'ACTIVE' ? 'Active' : item.status === 'SUSPENDED' ? 'Inactive' : item.status, permissions: item.permissions || [] })));
      if (departmentResult.status === 'fulfilled' && departmentResult.value) setDepartments((departmentResult.value.departments || []).map((item) => ({ ...item, status: item.status === 'ACTIVE' ? 'Active' : 'Inactive' })));
      if (articleResult.status === 'fulfilled' && articleResult.value) setArticles(articleResult.value.articles || []);
      if (auditResult.status === 'fulfilled' && auditResult.value) setActivities((auditResult.value.events || []).map((item) => ({ id: item.id, title: item.action.replaceAll('_', ' '), detail: `${item.targetType || ''} ${item.targetId || ''}`, time: new Date(item.createdAt).toLocaleString(), type: item.targetType === 'Ticket' ? 'Ticket' : item.targetType === 'User' ? 'User' : 'Admin' })));
      if (reportResult.status === 'fulfilled' && reportResult.value) setReport(reportResult.value);
      const failure = results.find((item) => item.status === 'rejected');
      if (failure) setApiError(apiMessage(failure.reason));
    } catch (error) { setApiError(apiMessage(error)); }
    finally { setPageLoading(false); }
  };
  useEffect(() => { loadOperations(); }, [user?.id]);
  const updateTicket = async (ticketId, changes) => {
    try {
      if (changes.priority) await ticketContext.updateTicketPriority(ticketId, changes.priority);
      if (changes.status) await ticketContext.updateTicketStatus(ticketId, changes.status);
      if (changes.agentId) await ticketContext.assignTicket(ticketId, changes.agentId);
      if (changes.note) await ticketContext.addComment(ticketId, changes.note, true);
      setTickets([...ticketContext.tickets]); await loadOperations();
    } catch (error) { setApiError(apiMessage(error)); throw error; }
  };
  const updateUserStatus = async (person, status) => {
    try {
      if (person.status === 'Pending') {
        await organisationService.reviewMember(person.id, status === 'Rejected' ? 'REJECT' : 'APPROVE', person.role === 'Support Agent' ? 'SUPPORT_AGENT' : 'EMPLOYEE', status === 'Rejected' ? 'Registration rejected by an administrator.' : undefined);
      } else {
        await organisationService.updateUserStatus(person.id, status === 'Active' ? 'ACTIVE' : 'SUSPENDED');
      }
      await loadOperations();
    } catch (error) { setApiError(apiMessage(error)); throw error; }
  };

  const activeTickets = tickets.filter((t) => t.status !== 'Resolved').length;
  const pendingUsers = users.filter((u) => u.status === 'Pending').length;
  const activeAgents = agents.filter((a) => a.status === 'Active').length;

  const filteredTickets = useMemo(() => {
    const query = ticketSearch.toLowerCase().trim();

    return tickets.filter((ticket) => {
      const matchesFilter =
        ticketFilter === 'All' || ticket.status === ticketFilter;

      const matchesSearch =
        !query ||
        (ticket.ticketNumber || ticket.id).toLowerCase().includes(query) ||
        ticket.title.toLowerCase().includes(query) ||
        (ticket.employeeName || '').toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [tickets, ticketSearch, ticketFilter]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.toLowerCase().trim();

    return users.filter((user) => {
      const matchesFilter =
        userFilter === 'All' || user.status === userFilter;

      const matchesSearch =
        !query ||
        (user.name || '').toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [users, userSearch, userFilter]);

  const showSection = (id) => {
    setSelectedTicket(null);
    setActiveSection(id);
  };

  // Dashboard overview
  const renderOverview = () => (
    <>
      <SectionHeading
        title="Admin Dashboard"
        subtitle="Manage your organisation's daily support operations."
      />

      <View style={styles.statsGrid}>
        <StatCard label="Total Tickets" value={tickets.length} icon="🎫" color="#3157D5" />
        <StatCard label="Open Tickets" value={activeTickets} icon="📂" color="#D97706" />
        <StatCard label="Pending Approvals" value={pendingUsers} icon="⏳" color="#9B51C6" />
        <StatCard label="Active Agents" value={activeAgents} icon="🎧" color="#16845B" />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Pending User Approvals</Text>
        <Text style={styles.description}>
          Review new employee and support agent registration requests.
        </Text>

        <View style={styles.rowBetween}>
          <Text style={styles.metricNumber}>{pendingUsers}</Text>
          <ActionButton
            title="Review Requests →"
            onPress={() => showSection('users')}
          />
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Ticket Overview</Text>
        {[
          ['Open', tickets.filter((t) => t.status === 'Open').length, '#D97706'],
          ['In Progress', tickets.filter((t) => t.status === 'In Progress').length, '#3157D5'],
          ['Resolved', tickets.filter((t) => t.status === 'Resolved').length, '#16845B'],
        ].map(([label, value, color]) => (
          <TouchableOpacity
            key={label}
            style={styles.summaryRow}
            onPress={() => {
              setTicketFilter(label);
              showSection('tickets');
            }}
          >
            <View style={[styles.statusDot, { backgroundColor: color }]} />
            <Text style={styles.summaryLabel}>{label}</Text>
            <Text style={styles.summaryValue}>{value}</Text>
          </TouchableOpacity>
        ))}
        <ActionButton
          title="View All Tickets"
          secondary
          onPress={async () => {
            setTicketFilter('All');
            showSection('tickets');
          }}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Quick Actions</Text>
        {[
          ['🎫', 'Manage Tickets', 'tickets'],
          ['👥', 'Approve Users', 'users'],
          ['🎧', 'Manage Support Agents', 'agents'],
          ['🛡️', 'Add Internal Admin', 'admins'],
          ['🏢', 'Manage Departments', 'departments'],
        ].map(([icon, label, id]) => (
          <TouchableOpacity
            style={styles.quickAction}
            key={id}
            onPress={() => showSection(id)}
          >
            <Text style={styles.quickIcon}>{icon}</Text>
            <Text style={styles.quickText}>{label}</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  // Ticket management
  const renderTickets = () => {
    if (selectedTicket) {
      const ticket = tickets.find((t) => t.id === selectedTicket);

      if (!ticket) {
        setSelectedTicket(null);
        return null;
      }

      return (
        <>
          <TouchableOpacity onPress={() => setSelectedTicket(null)}>
            <Text style={styles.back}>‹ Back to Tickets</Text>
          </TouchableOpacity>

          <SectionHeading
            title={ticket.id}
            subtitle="Ticket details and assignment"
          />

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{ticket.title}</Text>
            <Text style={styles.description}>{ticket.description}</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Raised by</Text>
            <Text style={styles.detailValue}>{ticket.employeeName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Department</Text>
              <Text style={styles.detailValue}>{ticket.department}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Created</Text>
            <Text style={styles.detailValue}>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : '—'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Assigned Agent</Text>
            <Text style={styles.detailValue}>{ticket.agentName || 'Unassigned'}</Text>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Assign Support Agent</Text>
            <Text style={styles.description}>
              Choose an active support agent to handle this ticket.
            </Text>

            {agents.filter((a) => a.status === 'Active').map((agent) => (
              <TouchableOpacity
                key={agent.id}
                style={[
                  styles.choiceRow,
                  selectedAgent === agent.id && styles.choiceSelected,
                ]}
                onPress={() => setSelectedAgent(agent.id)}
              >
                <Text style={styles.choiceText}>
                  {agent.name} · {agent.department || 'No department'}
                </Text>
                <Text style={styles.choiceMark}>
                  {selectedAgent === agent.id ? '✓' : '○'}
                </Text>
              </TouchableOpacity>
            ))}

            <ActionButton
              title="Assign Ticket"
              onPress={async () => {
                if (!selectedAgent) {
                  notify('Select an agent', 'Please select a support agent first.');
                  return;
                }
                try { await updateTicket(ticket.id, { agentId: selectedAgent }); } catch { return; }
                setSelectedAgent('');
                notify('Ticket assigned', `${ticket.ticketNumber || ticket.id} was assigned.`);
              }}
            />
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Update Ticket</Text>

            <Text style={styles.fieldLabel}>Priority</Text>
            <View style={styles.chipRow}>
              {['Low', 'Medium', 'High', 'Critical'].map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.chip,
                    selectedPriority === item && styles.chipActive,
                  ]}
                  onPress={() => setSelectedPriority(item)}
                >
                  <Text style={[
                    styles.chipText,
                    selectedPriority === item && styles.chipTextActive,
                  ]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Status</Text>
            <View style={styles.chipRow}>
              {(adminStatusTransitions[tickets.find((item) => item.id === selectedTicket)?.status] || []).map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.chip,
                    selectedStatus === item && styles.chipActive,
                  ]}
                  onPress={() => setSelectedStatus(item)}
                >
                  <Text style={[
                    styles.chipText,
                    selectedStatus === item && styles.chipTextActive,
                  ]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Admin Note</Text>
            <TextInput
              style={styles.input}
              placeholder="Add an internal note..."
              value={ticketNote}
              onChangeText={setTicketNote}
              multiline
            />

            <ActionButton
              title="Save Ticket Updates"
              onPress={async () => {
                try { await updateTicket(ticket.id, { priority: selectedPriority, status: selectedStatus, note: ticketNote }); setTicketNote(''); notify('Updated', 'Ticket details updated successfully.'); }
                catch (error) { notify('Update failed', apiMessage(error)); }
              }}
            />
          </View>
        </>
      );
    }

    return (
      <>
        <SectionHeading
          title="Ticket Management"
          subtitle="View, assign and track all organisation tickets."
        />

        <TextInput
          style={styles.input}
          placeholder="Search ticket ID, title or employee..."
          value={ticketSearch}
          onChangeText={setTicketSearch}
        />

        <View style={styles.chipRow}>
          {['All', 'Open', 'In Progress', 'Resolved'].map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.chip,
                ticketFilter === item && styles.chipActive,
              ]}
              onPress={() => setTicketFilter(item)}
            >
              <Text style={[
                styles.chipText,
                ticketFilter === item && styles.chipTextActive,
              ]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredTickets.map((ticket) => (
          <TouchableOpacity
            key={ticket.id}
            style={styles.panel}
            onPress={() => {
              setSelectedTicket(ticket.id);
              setSelectedAgent(ticket.assignedAgentId || '');
              setSelectedPriority(ticket.priority);
              setSelectedStatus(ticket.status);
            }}
          >
            <View style={styles.rowBetween}>
              <Text style={styles.ticketId}>{ticket.ticketNumber || ticket.id}</Text>
              <Text style={styles.statusBadge}>{ticket.status}</Text>
            </View>
            <Text style={styles.panelTitle}>{ticket.title}</Text>
            <Text style={styles.description}>
              {ticket.employeeName} · {ticket.department}
            </Text>
            <View style={styles.rowBetween}>
              <Text style={styles.mutedText}>
                Priority: {ticket.priority}
              </Text>
              <Text style={styles.linkText}>View & Assign →</Text>
            </View>
            <Text style={styles.mutedText}>
              Agent: {ticket.agentName || 'Not assigned'}
            </Text>
          </TouchableOpacity>
        ))}

        {filteredTickets.length === 0 && (
          <Text style={styles.emptyText}>No tickets found.</Text>
        )}
      </>
    );
  };

  // User management
  const renderUsers = () => (
    <>
      <SectionHeading
        title="User Management"
        subtitle="Approve registrations and manage employee account access."
      />

      <View style={styles.statsGrid}>
        <StatCard label="Total Users" value={users.length} icon="👥" color="#3157D5" />
        <StatCard label="Pending" value={pendingUsers} icon="⏳" color="#9B51C6" />
        <StatCard label="Active" value={users.filter((u) => u.status === 'Active').length} icon="✓" color="#16845B" />
        <StatCard label="Inactive" value={users.filter((u) => u.status === 'Inactive').length} icon="🚫" color="#C0392B" />
      </View>

      <TextInput
        style={styles.input}
        placeholder="Search name or email..."
        value={userSearch}
        onChangeText={setUserSearch}
      />

      <View style={styles.chipRow}>
        {['All', 'Pending', 'Active', 'Inactive', 'Rejected'].map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.chip, userFilter === item && styles.chipActive]}
            onPress={() => setUserFilter(item)}
          >
            <Text style={[
              styles.chipText,
              userFilter === item && styles.chipTextActive,
            ]}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filteredUsers.map((user) => (
        <View style={styles.panel} key={user.id}>
          <View style={styles.rowBetween}>
            <Text style={styles.panelTitle}>{user.name}</Text>
            <Text style={styles.statusBadge}>{user.status}</Text>
          </View>
          <Text style={styles.description}>{user.email}</Text>
          <Text style={styles.mutedText}>
            {user.role} · {user.department}
          </Text>

          {user.status === 'Pending' && (
            <View style={styles.buttonRow}>
              <View style={{ flex: 1 }}>
                <ActionButton
                  title="Approve"
                  onPress={async () => { try { await updateUserStatus(user, 'Active'); notify('Approved', `${user.name} is now active.`); } catch (error) { notify('Approval failed', apiMessage(error)); } }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ActionButton
                  title="Reject"
                  secondary
                  onPress={async () => { try { await updateUserStatus(user, 'Rejected'); notify('Rejected', `${user.name}'s request was rejected.`); } catch (error) { notify('Rejection failed', apiMessage(error)); } }}
                />
              </View>
            </View>
          )}

          {user.status === 'Active' && (
            <ActionButton
              title="Deactivate Account"
              secondary
              onPress={async () => { try { await updateUserStatus(user, 'Inactive'); notify('Account deactivated', `${user.name}'s account is now inactive.`); } catch (error) { notify('Update failed', apiMessage(error)); } }}
            />
          )}

          {user.status === 'Inactive' && (
            <ActionButton
              title="Activate Account"
              onPress={async () => { try { await updateUserStatus(user, 'Active'); notify('Account activated', `${user.name}'s account is active again.`); } catch (error) { notify('Update failed', apiMessage(error)); } }}
            />
          )}
        </View>
      ))}

      {filteredUsers.length === 0 && (
        <Text style={styles.emptyText}>No users found.</Text>
      )}
    </>
  );

  // Support agents
  const renderAgents = () => (
    <>
      <SectionHeading
        title="Support Agents"
        subtitle="Manage support agents and monitor their ticket workload."
      />

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Register a Support Agent</Text>
        <Text style={styles.description}>Support Agents register through the member registration flow, verify their company email, and appear here for approval. The backend does not provide administrator-created agent accounts.</Text>
      </View>

      {agents.map((agent) => (
        <View style={styles.panel} key={agent.id}>
          <View style={styles.rowBetween}>
            <Text style={styles.panelTitle}>{agent.name}</Text>
            <Text style={styles.statusBadge}>{agent.status}</Text>
          </View>
          <Text style={styles.description}>{agent.email}</Text>
          <Text style={styles.mutedText}>Department: {agent.department}</Text>
          <Text style={styles.mutedText}>
            Assigned tickets: {agent.assigned}
          </Text>
          {['Active', 'Inactive'].includes(agent.status) ? <ActionButton
            title={agent.status === 'Active' ? 'Deactivate Agent' : 'Activate Agent'}
            secondary={agent.status === 'Active'}
            onPress={async () => { try { await organisationService.updateUserStatus(agent.id, agent.status === 'Active' ? 'SUSPENDED' : 'ACTIVE'); await loadOperations(); } catch (error) { notify('Update failed', apiMessage(error)); } }}
          /> : <Text style={styles.note}>This registration must be approved in User Management after email verification.</Text>}
        </View>
      ))}
    </>
  );

  // Internal administrator management
  const renderAdmins = () => (
    <>
      <SectionHeading
        title="Internal Administrators"
        subtitle="Create internal admins and delegate operational permissions."
      />

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Add Internal Admin</Text>
        <Text style={styles.description}>
          Only the Primary Admin can create internal administrator accounts.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Full name"
          value={newAdminName}
          onChangeText={setNewAdminName}
        />
        <TextInput
          style={styles.input}
          placeholder="Company email"
          value={newAdminEmail}
          onChangeText={setNewAdminEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput style={styles.input} placeholder="Phone number" value={newAdminPhone} onChangeText={setNewAdminPhone} keyboardType="phone-pad" />

        <Text style={styles.fieldLabel}>Delegate Permissions</Text>

        {permissionsList.map((permission) => {
          const checked = newAdminPermissions.includes(permission.id);

          return (
            <TouchableOpacity
              key={permission.id}
              style={styles.permissionRow}
              onPress={() => {
                setNewAdminPermissions((previous) =>
                  checked
                    ? previous.filter((p) => p !== permission.id)
                    : [...previous, permission.id]
                );
              }}
            >
              <Text style={styles.permissionLabel}>{permission.label}</Text>
              <Text style={styles.permissionCheck}>
                {checked ? '☑' : '☐'}
              </Text>
            </TouchableOpacity>
          );
        })}

        <ActionButton
          title="Create Internal Admin"
          onPress={async () => {
            if (!newAdminName.trim() || !newAdminEmail.includes('@') || !newAdminPhone.trim()) {
              notify('Invalid details', 'Enter a name and valid email address.');
              return;
            }

            if (newAdminPermissions.length === 0) {
              notify('Select permissions', 'Choose at least one permission.');
              return;
            }

            try {
              await organisationService.inviteInternalAdmin({ fullName: newAdminName.trim(), email: newAdminEmail.trim(), phone: newAdminPhone.trim(), permissions: newAdminPermissions });
              setNewAdminName(''); setNewAdminEmail(''); setNewAdminPhone(''); setNewAdminPermissions(['tickets:read']);
              await loadOperations();
              notify('Invitation sent', 'The Internal Admin must accept the emailed invitation code.');
            } catch (error) { notify('Invitation failed', apiMessage(error)); }
          }}
        />
      </View>

      {admins.map((admin) => (
        <View style={styles.panel} key={admin.id}>
          <View style={styles.rowBetween}>
            <Text style={styles.panelTitle}>{admin.name}</Text>
            <Text style={styles.statusBadge}>{admin.status}</Text>
          </View>
          <Text style={styles.description}>{admin.email}</Text>
          <Text style={styles.fieldLabel}>Granted Permissions</Text>
          {permissionsList.map((permission) => {
            const checked = admin.permissions.includes(permission.id);
            return <TouchableOpacity key={permission.id} style={styles.permissionRow} onPress={async () => {
              const next = checked ? admin.permissions.filter((item) => item !== permission.id) : [...admin.permissions, permission.id];
              try { await organisationService.updateInternalAdminPermissions(admin.id, next); await loadOperations(); }
              catch (error) { notify('Permission update failed', apiMessage(error)); }
            }}><Text style={styles.permissionLabel}>{permission.label}</Text><Text style={styles.permissionCheck}>{checked ? '☑' : '☐'}</Text></TouchableOpacity>;
          })}
          {['Active', 'Inactive'].includes(admin.status) ? <ActionButton
            title={admin.status === 'Active' ? 'Deactivate Internal Admin' : 'Activate Internal Admin'}
            secondary={admin.status === 'Active'}
            onPress={async () => { try { await organisationService.updateInternalAdminStatus(admin.id, admin.status === 'Active' ? 'SUSPENDED' : 'ACTIVE'); await loadOperations(); } catch (error) { notify('Update failed', apiMessage(error)); } }}
          /> : <Text style={styles.note}>This invitee must accept the email invitation before the account is active.</Text>}
        </View>
      ))}
    </>
  );

  // Departments
  const renderDepartments = () => (
    <>
      <SectionHeading
        title="Departments"
        subtitle="Organise employees and support teams into departments."
      />

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Create Department</Text>
        <TextInput
          style={styles.input}
          placeholder="Department name"
          value={newDepartment}
          onChangeText={setNewDepartment}
        />
        <ActionButton
          title={editingDepartmentId ? 'Save Department' : 'Add Department'}
          onPress={async () => {
            if (!newDepartment.trim()) {
              notify('Department name required', 'Enter a department name.');
              return;
            }

            if (departments.some((d) => d.id !== editingDepartmentId && d.name.toLowerCase() === newDepartment.trim().toLowerCase())) {
              notify('Already exists', 'This department already exists.');
              return;
            }

            try { if (editingDepartmentId) await organisationService.updateDepartment(editingDepartmentId, { name: newDepartment.trim() }); else await organisationService.createDepartment(newDepartment.trim()); setEditingDepartmentId(null); setNewDepartment(''); await loadOperations(); notify('Saved', 'The department was saved.'); }
            catch (error) { notify('Could not create department', apiMessage(error)); }
          }}
        />
      </View>

      {departments.map((department) => (
        <View style={styles.panel} key={department.id}>
          <View style={styles.rowBetween}>
            <Text style={styles.panelTitle}>{department.name}</Text>
            <Text style={styles.statusBadge}>{department.status}</Text>
          </View>
          <Text style={styles.description}>{department.description || 'No description provided.'}</Text>
          <TouchableOpacity onPress={() => { setEditingDepartmentId(department.id); setNewDepartment(department.name); }}><Text style={styles.linkText}>Edit department</Text></TouchableOpacity>
          <ActionButton
            title={department.status === 'Active' ? 'Deactivate Department' : 'Activate Department'}
            secondary
            onPress={async () => { try { await organisationService.updateDepartment(department.id, { status: department.status === 'Active' ? 'INACTIVE' : 'ACTIVE' }); await loadOperations(); } catch (error) { notify('Update failed', apiMessage(error)); } }}
          />
        </View>
      ))}
    </>
  );

  // Reports
  const renderReports = () => {
    const reportStatuses = report?.statusCounts || {};

    return (
      <>
        <SectionHeading
          title="Reports & Analytics"
          subtitle="Monitor ticket volume, workload and support performance."
        />

        <View style={styles.statsGrid}>
          <StatCard label="Total Tickets" value={report?.totals?.tickets ?? '—'} icon="🎫" color="#3157D5" />
          <StatCard label="Resolved" value={report?.totals?.resolved ?? '—'} icon="✓" color="#16845B" />
          <StatCard label="Assigned" value={report?.agentPerformance?.reduce((sum, item) => sum + item.assigned, 0) ?? '—'} icon="👤" color="#9B51C6" />
          <StatCard label="Unassigned" value={report ? Math.max(0, report.totals.tickets - report.agentPerformance.reduce((sum, item) => sum + item.assigned, 0)) : '—'} icon="⏳" color="#D97706" />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Ticket Status Distribution</Text>
          {['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED'].map((status) => {
            const count = reportStatuses[status] || 0;
            const percentage = report?.totals?.tickets
              ? (count / report.totals.tickets) * 100
              : 0;

            return (
              <View key={status} style={styles.reportRow}>
                <View style={styles.rowBetween}>
                  <Text style={styles.summaryLabel}>{status.replaceAll('_', ' ')}</Text>
                  <Text style={styles.summaryValue}>{count}</Text>
                </View>
                <View style={styles.progressBackground}>
                  <View style={[styles.progressFill, { width: `${percentage}%` }]} />
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Agent Workload</Text>
          {(report?.agentPerformance || []).map((agent) => (
            <View key={agent.id} style={styles.reportRow}>
              <View style={styles.rowBetween}>
                <Text style={styles.summaryLabel}>{agent.name}</Text>
                <Text style={styles.summaryValue}>{agent.assigned} assigned · {agent.resolved} resolved</Text>
              </View>
            </View>
          ))}
        </View>

        {!report ? <Text style={styles.note}>Report data is unavailable for this account or request.</Text> : null}
      </>
    );
  };

  // Activity logs
  const renderActivity = () => {
    const visibleActivities = activities.filter(
      (item) => activityFilter === 'All' || item.type === activityFilter
    );

    return (
      <>
        <SectionHeading
          title="Activity Logs"
          subtitle="Review administrative and operational activities."
        />

        <View style={styles.chipRow}>
          {['All', 'Ticket', 'User', 'Admin'].map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.chip,
                activityFilter === item && styles.chipActive,
              ]}
              onPress={() => setActivityFilter(item)}
            >
              <Text style={[
                styles.chipText,
                activityFilter === item && styles.chipTextActive,
              ]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {visibleActivities.map((item) => (
          <View style={styles.panel} key={item.id}>
            <Text style={styles.panelTitle}>{item.title}</Text>
            <Text style={styles.description}>{item.detail}</Text>
            <View style={styles.rowBetween}>
              <Text style={styles.statusBadge}>{item.type}</Text>
              <Text style={styles.mutedText}>{item.time}</Text>
            </View>
          </View>
        ))}

      </>
    );
  };

  // Knowledge Base
  const renderKnowledge = () => (
    <>
      <SectionHeading
        title="Knowledge Base"
        subtitle="Publish helpful guides for employees and support agents."
      />

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Create Article</Text>
        <TextInput
          style={styles.input}
          placeholder="Article title"
          value={newArticleTitle}
          onChangeText={setNewArticleTitle}
        />
        <TextInput
          style={styles.input}
          placeholder="Category"
          value={newArticleCategory}
          onChangeText={setNewArticleCategory}
        />
        <TextInput style={styles.input} placeholder="Article content" value={newArticleContent} onChangeText={setNewArticleContent} multiline />
        <ActionButton
          title={selectedArticleId ? 'Save Article Changes' : 'Create Draft Article'}
          onPress={async () => {
            if (!newArticleTitle.trim() || !newArticleCategory.trim() || !newArticleContent.trim()) {
              notify('Missing details', 'Enter a title, category and article content.');
              return;
            }
            try {
              if (selectedArticleId) await knowledgeBaseService.update(selectedArticleId, { title: newArticleTitle.trim(), category: newArticleCategory.trim(), content: newArticleContent.trim() });
              else await knowledgeBaseService.create({ title: newArticleTitle.trim(), category: newArticleCategory.trim(), content: newArticleContent.trim(), status: 'Draft' });
              setSelectedArticleId(null); setNewArticleTitle(''); setNewArticleCategory(''); setNewArticleContent(''); await loadOperations(); notify('Saved', 'The article was saved.');
            }
            catch (error) { notify('Could not create article', apiMessage(error)); }
          }}
        />
      </View>

      {articles.map((article) => (
        <View style={styles.panel} key={article.id}>
          <Text style={styles.panelTitle}>{article.title}</Text>
          <Text style={styles.description}>{article.category}</Text>
          <Text numberOfLines={3} style={styles.description}>{article.summary || article.content}</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.statusBadge}>{article.status}</Text>
            <TouchableOpacity onPress={() => { setSelectedArticleId(article.id); setNewArticleTitle(article.title); setNewArticleCategory(article.category); setNewArticleContent(article.content || ''); }}><Text style={styles.linkText}>Edit</Text></TouchableOpacity>
            <TouchableOpacity
              onPress={async () => { try { const status = article.status === 'Published' ? 'Archived' : 'Published'; await knowledgeBaseService.update(article.id, { status }); await loadOperations(); } catch (error) { notify('Article update failed', apiMessage(error)); } }}
            >
              <Text style={styles.linkText}>
                {article.status === 'Published' ? 'Archive' : 'Publish'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={async () => { try { await knowledgeBaseService.remove(article.id); await loadOperations(); } catch (error) { notify('Delete failed', apiMessage(error)); } }}><Text style={styles.linkText}>Delete</Text></TouchableOpacity>
          </View>
        </View>
      ))}
    </>
  );

  // Admin settings
  const renderSettings = () => (
    <>
      <SectionHeading
        title="Admin Settings"
        subtitle="Manage your operational preferences and notifications."
      />

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Notification Preferences</Text>
        <Text style={styles.description}>Notification preference settings are not exposed by the backend.</Text>

        {[
          'Email Notifications', 'Ticket Notifications', 'Approval Notifications',
        ].map((label) => (
          <View style={styles.settingRow} key={label}>
            <Text style={styles.settingLabel}>{label}</Text>
            <Switch disabled
              value={false}
              trackColor={{ false: '#D8DEE9', true: '#AFC1FF' }}
              thumbColor="#FFFFFF"
            />
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Admin Account</Text>
        <Text style={styles.description}>
          Signed in as {user?.fullName || user?.email || '—'}.
        </Text>
        <Text style={styles.mutedText}>
          Organisation: {user?.organisationId || '—'}
        </Text>
        <Text style={styles.mutedText}>
          Role: {user?.role || '—'}
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Operational Rules</Text>
        <Text style={styles.description}>
          Internal Admins receive delegated permissions. Only the Primary Admin
          can manage internal administrator accounts in this initial design.
        </Text>
      </View>
    </>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return renderOverview();
      case 'tickets':
        return renderTickets();
      case 'users':
        return renderUsers();
      case 'agents':
        return renderAgents();
      case 'admins':
        return renderAdmins();
      case 'departments':
        return renderDepartments();
      case 'reports':
        return renderReports();
      case 'activity':
        return renderActivity();
      case 'knowledge':
        return renderKnowledge();
      case 'settings':
        return renderSettings();
      default:
        return renderOverview();
    }
  };

  const completeSignOut = async () => { try { await logout(); } catch { notify('Signed out locally', 'The server could not confirm session revocation.'); } navigation.replace('Welcome'); };
  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) {
        completeSignOut();
      }
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: completeSignOut,
        },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>ST</Text>
          </View>
          <View>
            <Text style={styles.brandName}>SmartTracker</Text>
            <Text style={styles.brandSubtitle}>ADMIN PORTAL</Text>
          </View>
        </View>

        <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>{user?.role === 'INTERNAL_ADMIN' ? 'IA' : 'PA'}</Text>
        </View>
      </View>

      <View style={styles.welcomeBanner}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcomeLabel}>{user?.role === 'INTERNAL_ADMIN' ? 'INTERNAL ADMINISTRATOR' : 'PRIMARY ADMINISTRATOR'}</Text>
          <Text style={styles.welcomeTitle}>Welcome, {user?.fullName || 'Administrator'}!</Text>
          <Text style={styles.welcomeSubtitle}>
            Manage your organisation's daily operations.
          </Text>
        </View>
        <Text style={styles.welcomeIcon}>🛡️</Text>
      </View>

      <View style={styles.navigationContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.navigationContent}
        >
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.navItem,
                activeSection === item.id && styles.navItemActive,
              ]}
              onPress={() => showSection(item.id)}
            >
              <Text style={styles.navIcon}>{item.icon}</Text>
              <Text
                style={[
                  styles.navLabel,
                  activeSection === item.id && styles.navLabelActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {pageLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#3157D5" />
            <Text style={styles.loadingText}>Refreshing your workspace…</Text>
          </View>
        ) : null}
        {apiError ? (
          <View style={styles.errorBanner}>
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>Some workspace data could not be loaded</Text>
              <Text style={styles.errorMessage}>{apiError}</Text>
            </View>
            <TouchableOpacity
              onPress={loadOperations}
              disabled={pageLoading}
              style={styles.retryButton}
              accessibilityRole="button"
              accessibilityLabel="Retry loading workspace data"
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {renderContent()}

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          SmartTracker · Admin Portal
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FC' },
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
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#3157D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  brandName: { color: '#17233D', fontSize: 17, fontWeight: '800' },
  brandSubtitle: {
    color: '#7C879A',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.3,
    marginTop: 2,
  },
  adminBadge: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: '#EAF0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminBadgeText: { color: '#3157D5', fontSize: 14, fontWeight: '800' },
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
  welcomeTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  welcomeSubtitle: { color: '#DCE5FF', fontSize: 12, marginTop: 6 },
  welcomeIcon: { fontSize: 40, marginLeft: 10 },
  navigationContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EAEFF5',
  },
  navigationContent: { paddingHorizontal: 12, paddingVertical: 11, gap: 7 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: '#F5F7FC',
    gap: 7,
  },
  navItemActive: { backgroundColor: '#EAF0FF' },
  navIcon: { fontSize: 14 },
  navLabel: { color: '#68758B', fontSize: 11, fontWeight: '600' },
  navLabelActive: { color: '#3157D5', fontWeight: '800' },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 35, width: '100%', maxWidth: 1152, alignSelf: 'center' },
  heading: { marginBottom: 18 },
  headingTitle: { color: '#17233D', fontSize: 22, fontWeight: '800' },
  headingSubtitle: { color: '#788499', fontSize: 12, lineHeight: 18, marginTop: 5 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
  statCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: 130,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: '#EAEFF5',
  },
  statIcon: { fontSize: 19, marginBottom: 9 },
  statValue: { fontSize: 25, fontWeight: '800' },
  statLabel: { color: '#788499', fontSize: 11, marginTop: 4 },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EAEFF5',
  },
  panelTitle: { color: '#27344D', fontSize: 14, fontWeight: '800' },
  description: { color: '#8792A5', fontSize: 11, lineHeight: 17, marginTop: 6 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricNumber: { color: '#9B51C6', fontSize: 28, fontWeight: '800' },
  primaryButton: {
    backgroundColor: '#3157D5',
    borderRadius: 9,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#DCE3F0',
    borderRadius: 9,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: { color: '#3157D5', fontSize: 12, fontWeight: '700' },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F6',
  },
  statusDot: { width: 9, height: 9, borderRadius: 5, marginRight: 10 },
  summaryLabel: { flex: 1, color: '#526078', fontSize: 12 },
  summaryValue: { color: '#17233D', fontSize: 12, fontWeight: '800' },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F6',
  },
  quickIcon: { fontSize: 19, marginRight: 12 },
  quickText: { flex: 1, color: '#27344D', fontSize: 12, fontWeight: '700' },
  arrow: { color: '#8490A3', fontSize: 23 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E6F0',
    borderRadius: 9,
    padding: 12,
    color: '#27344D',
    fontSize: 12,
    marginTop: 11,
    minHeight: 43,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginVertical: 12 },
  chip: {
    backgroundColor: '#F0F2F8',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 11,
  },
  chipActive: { backgroundColor: '#3157D5' },
  chipText: { color: '#68758B', fontSize: 10, fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF' },
  ticketId: { color: '#3157D5', fontSize: 11, fontWeight: '800' },
  statusBadge: {
    color: '#3157D5',
    backgroundColor: '#EAF0FF',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    fontSize: 9,
    fontWeight: '800',
    overflow: 'hidden',
  },
  mutedText: { color: '#8792A5', fontSize: 10, marginTop: 7 },
  linkText: { color: '#3157D5', fontSize: 11, fontWeight: '800' },
  emptyText: { color: '#8792A5', textAlign: 'center', padding: 25 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, gap: 9 },
  loadingText: { color: '#68758B', fontSize: 12 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF1F0', borderWidth: 1, borderColor: '#F6D0CC', borderRadius: 10, padding: 12, marginBottom: 14, gap: 12 },
  errorCopy: { flex: 1 },
  errorTitle: { color: '#9F2D25', fontSize: 12, fontWeight: '800' },
  errorMessage: { color: '#85423D', fontSize: 11, lineHeight: 16, marginTop: 4 },
  retryButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7B8B3', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  retryText: { color: '#9F2D25', fontSize: 11, fontWeight: '800' },
  back: { color: '#3157D5', fontWeight: '700', marginBottom: 18 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F6',
    gap: 12,
  },
  detailLabel: { color: '#8792A5', fontSize: 11 },
  detailValue: { color: '#27344D', fontSize: 11, fontWeight: '700', flexShrink: 1 },
  choiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 9,
    padding: 12,
    marginTop: 8,
  },
  choiceSelected: { borderColor: '#3157D5', backgroundColor: '#EAF0FF' },
  choiceText: { color: '#526078', fontSize: 11, flex: 1 },
  choiceMark: { color: '#3157D5', fontWeight: '800', marginLeft: 8 },
  fieldLabel: { color: '#526078', fontSize: 11, fontWeight: '800', marginTop: 15 },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F6',
  },
  permissionLabel: { color: '#526078', fontSize: 11, marginTop: 5 },
  permissionCheck: { color: '#3157D5', fontSize: 16 },
  buttonRow: { flexDirection: 'row', gap: 9, marginTop: 5 },
  reportRow: { marginTop: 15 },
  progressBackground: {
    height: 8,
    backgroundColor: '#EDF0F6',
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: { height: '100%', backgroundColor: '#3157D5', borderRadius: 5 },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F6',
  },
  settingLabel: { color: '#526078', fontSize: 12 },
  note: { color: '#929CAE', fontSize: 10, lineHeight: 16, marginTop: 10 },
  signOutButton: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F0D5D5',
    alignItems: 'center',
    marginTop: 15,
    backgroundColor: '#FFFFFF',
  },
  signOutText: { color: '#C0392B', fontSize: 13, fontWeight: '700' },
  footer: { textAlign: 'center', color: '#A1AABA', fontSize: 10, marginTop: 20 },
});
