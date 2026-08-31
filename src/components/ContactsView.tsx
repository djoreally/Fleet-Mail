import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Mail,
  Phone,
  Building,
  Briefcase,
  Star,
  MoreVertical,
  Edit2,
  Trash2,
  Sparkles,
  Bot,
  Copy,
  Check,
  Tag,
  ExternalLink,
  RefreshCw,
  UserCheck,
  Clock
} from 'lucide-react';
import { Contact, EmailMessage } from '../types';

interface ContactsViewProps {
  contacts: Contact[];
  emails: EmailMessage[];
  onAddContact: (contactData: Partial<Contact>) => Promise<boolean>;
  onUpdateContact: (id: string, contactData: Partial<Contact>) => Promise<boolean>;
  onDeleteContact: (id: string) => Promise<boolean>;
  onExtractFromInbox: () => Promise<number>;
  onComposeTo: (email: string, name?: string) => void;
  onAskAIAboutContact: (contact: Contact) => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  emails,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
  onExtractFromInbox,
  onComposeTo,
  onAskAIAboutContact
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formTagInput, setFormTagInput] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formIsFavorite, setFormIsFavorite] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Available tag categories for quick selection
  const popularTags = ['VIP', 'Team', 'Executive', 'Engineering', 'Design', 'Client', 'Investor', 'Partners'];

  // Filter contacts
  const filteredContacts = contacts.filter((c) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !query ||
      c.name.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query) ||
      (c.company && c.company.toLowerCase().includes(query)) ||
      (c.role && c.role.toLowerCase().includes(query)) ||
      (c.tags && c.tags.some((t) => t.toLowerCase().includes(query)));

    if (!matchesQuery) return false;

    if (selectedTag === 'All') return true;
    if (selectedTag === 'Favorites') return Boolean(c.isFavorite);
    return c.tags?.includes(selectedTag);
  });

  const favoritesCount = contacts.filter((c) => c.isFavorite).length;

  const handleOpenAddModal = () => {
    setEditingContact(null);
    setFormName('');
    setFormEmail('');
    setFormCompany('');
    setFormRole('');
    setFormPhone('');
    setFormTags(['VIP']);
    setFormNotes('');
    setFormIsFavorite(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (contact: Contact, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingContact(contact);
    setFormName(contact.name);
    setFormEmail(contact.email);
    setFormCompany(contact.company || '');
    setFormRole(contact.role || '');
    setFormPhone(contact.phone || '');
    setFormTags(contact.tags || []);
    setFormNotes(contact.notes || '');
    setFormIsFavorite(Boolean(contact.isFavorite));
    setIsModalOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail.trim() || isSaving) return;

    setIsSaving(true);
    const payload: Partial<Contact> = {
      name: formName.trim() || formEmail.split('@')[0],
      email: formEmail.trim().toLowerCase(),
      company: formCompany.trim() || undefined,
      role: formRole.trim() || undefined,
      phone: formPhone.trim() || undefined,
      tags: formTags.length > 0 ? formTags : ['General'],
      notes: formNotes.trim() || undefined,
      isFavorite: formIsFavorite
    };

    let success = false;
    if (editingContact) {
      success = await onUpdateContact(editingContact.id, payload);
    } else {
      success = await onAddContact(payload);
    }

    setIsSaving(false);
    if (success) {
      setIsModalOpen(false);
    }
  };

  const handleToggleFavorite = async (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    await onUpdateContact(contact.id, { isFavorite: !contact.isFavorite });
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this contact?')) {
      await onDeleteContact(id);
      if (selectedContact?.id === id) {
        setSelectedContact(null);
      }
    }
  };

  const handleCopyEmail = (emailStr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(emailStr);
    setCopiedEmail(emailStr);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleSyncFromInbox = async () => {
    setIsSyncing(true);
    await onExtractFromInbox();
    setIsSyncing(false);
  };

  const toggleTagSelection = (tag: string) => {
    if (formTags.includes(tag)) {
      setFormTags(formTags.filter((t) => t !== tag));
    } else {
      setFormTags([...formTags, tag]);
    }
  };

  const handleAddCustomTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && formTagInput.trim()) {
      e.preventDefault();
      const newTag = formTagInput.trim();
      if (!formTags.includes(newTag)) {
        setFormTags([...formTags, newTag]);
      }
      setFormTagInput('');
    }
  };

  // Get emails linked to selected contact
  const linkedEmails = selectedContact
    ? emails.filter(
        (e) =>
          e.from.toLowerCase().includes(selectedContact.email.toLowerCase()) ||
          (Array.isArray(e.to)
            ? e.to.some((addr) => addr.toLowerCase().includes(selectedContact.email.toLowerCase()))
            : typeof e.to === 'string' && e.to.toLowerCase().includes(selectedContact.email.toLowerCase()))
      )
    : [];

  return (
    <div id="contacts-view-pane" className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      {/* Header Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0b57d0] flex items-center justify-center border border-blue-100">
                <Users className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Contacts & Address Book
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {contacts.length} total
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Organize your network, fast-compose messages, and connect with AI-assisted drafting.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="sync-inbox-contacts-btn"
              onClick={handleSyncFromInbox}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 text-xs font-semibold transition-all duration-150"
              title="Automatically extract contact names and emails from received AgentMail messages"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#0b57d0]' : 'text-slate-600'}`} />
              <span>{isSyncing ? 'Scanning Inbox...' : 'Extract from Inbox'}</span>
            </button>

            <button
              id="add-new-contact-btn"
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0b57d0] hover:bg-[#0848b0] active:scale-[0.98] text-white text-xs font-semibold shadow-sm transition-all duration-150"
            >
              <Plus className="w-4 h-4" />
              <span>New Contact</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Row */}
        <div className="mt-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, company, tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0b57d0]/20 focus:border-[#0b57d0] transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
            {['All', 'Favorites', 'VIP', 'Team', 'Executive', 'Investor', 'Partners'].map((tag) => {
              const isSelected = selectedTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors duration-150 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#0b57d0] text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {tag === 'Favorites' && <Star className="w-3 h-3 fill-amber-400 text-amber-400" />}
                  <span>{tag}</span>
                  {tag === 'Favorites' && favoritesCount > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {favoritesCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area with Side Profile Drawer if selected */}
      <div className="flex-1 flex overflow-hidden">
        {/* Contact Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredContacts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white rounded-2xl border border-slate-200 border-dashed">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0b57d0] flex items-center justify-center mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">No contacts found</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
                {searchQuery
                  ? `No contacts match "${searchQuery}". Try a different filter or clear your search.`
                  : 'Start building your address book by adding a contact or extracting from your recent emails.'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 rounded-xl bg-[#0b57d0] hover:bg-[#0848b0] text-white text-xs font-semibold shadow-sm transition-all"
                >
                  Add Contact
                </button>
                <button
                  onClick={handleSyncFromInbox}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-all"
                >
                  Extract from Inbox
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContacts.map((contact) => {
                const isSelected = selectedContact?.id === contact.id;
                return (
                  <div
                    key={contact.id}
                    id={`contact-card-${contact.id}`}
                    onClick={() => setSelectedContact(contact)}
                    className={`bg-white rounded-2xl border transition-all duration-150 p-5 flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-blue-200 group ${
                      isSelected
                        ? 'border-[#0b57d0] ring-2 ring-[#0b57d0]/10 shadow-sm'
                        : 'border-slate-200'
                    }`}
                  >
                    <div>
                      {/* Top Row: Avatar, Star & Actions */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              contact.avatarUrl ||
                              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                contact.name || contact.email
                              )}`
                            }
                            alt={contact.name}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                          />
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                              <span>{contact.name}</span>
                              {contact.tags?.includes('VIP') && (
                                <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded-md">
                                  VIP
                                </span>
                              )}
                            </h3>
                            {contact.role && (
                              <p className="text-xs text-slate-600 truncate mt-0.5 flex items-center gap-1">
                                <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{contact.role}</span>
                              </p>
                            )}
                            {contact.company && (
                              <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                                <Building className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{contact.company}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Favorite & Edit Menu */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleToggleFavorite(contact, e)}
                            title={contact.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            <Star
                              className={`w-4 h-4 ${
                                contact.isFavorite
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-300 hover:text-slate-400'
                              }`}
                            />
                          </button>
                          <button
                            onClick={(e) => handleOpenEditModal(contact, e)}
                            title="Edit contact"
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Contact Info (Email & Phone) */}
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center justify-between group/copy">
                          <div className="flex items-center gap-2 min-w-0">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate font-mono text-[11px] text-slate-700">
                              {contact.email}
                            </span>
                          </div>
                          <button
                            onClick={(e) => handleCopyEmail(contact.email, e)}
                            title="Copy email"
                            className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors"
                          >
                            {copiedEmail === contact.email ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        {contact.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-[11px] text-slate-600">{contact.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      {contact.tags && contact.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {contact.tags.map((t) => (
                            <span
                              key={t}
                              className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Strip */}
                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onComposeTo(contact.email, contact.name);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#0b57d0] text-xs font-semibold transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Compose</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAskAIAboutContact(contact);
                        }}
                        className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-700 text-xs font-semibold transition-colors"
                        title="Ask AI to draft an introductory or follow-up note"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        <span>AI Draft</span>
                      </button>

                      <button
                        onClick={(e) => handleDelete(contact.id, e)}
                        title="Delete contact"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Contact Side Profile Panel */}
        {selectedContact && (
          <div
            id="contact-detail-drawer"
            className="w-80 lg:w-96 bg-white border-l border-slate-200 flex flex-col h-full shrink-0 shadow-lg lg:shadow-none animate-in slide-in-from-right-4 duration-150"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Contact Overview</h2>
              <button
                onClick={() => setSelectedContact(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Profile Card */}
              <div className="flex flex-col items-center text-center pb-4 border-b border-slate-100">
                <img
                  src={
                    selectedContact.avatarUrl ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                      selectedContact.name
                    )}`
                  }
                  alt={selectedContact.name}
                  className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-sm mb-3 bg-slate-100"
                />
                <h3 className="text-base font-bold text-slate-900">{selectedContact.name}</h3>
                {selectedContact.role && (
                  <p className="text-xs text-slate-600 font-medium mt-0.5">{selectedContact.role}</p>
                )}
                {selectedContact.company && (
                  <p className="text-xs text-slate-500">{selectedContact.company}</p>
                )}

                {/* Primary CTA Buttons */}
                <div className="flex items-center gap-2 mt-4 w-full">
                  <button
                    onClick={() => onComposeTo(selectedContact.email, selectedContact.name)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#0b57d0] hover:bg-[#0848b0] text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send Email</span>
                  </button>
                  <button
                    onClick={() => onAskAIAboutContact(selectedContact)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold transition-all"
                    title="Generate personalized AI message draft"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>AI Copilot</span>
                  </button>
                </div>
              </div>

              {/* Contact Metadata */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Contact Details
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[11px] text-slate-500 font-medium">Email Address</p>
                    <p className="font-mono text-slate-800 font-semibold mt-0.5 select-all">
                      {selectedContact.email}
                    </p>
                  </div>

                  {selectedContact.phone && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] text-slate-500 font-medium">Phone Number</p>
                      <p className="text-slate-800 font-semibold mt-0.5">{selectedContact.phone}</p>
                    </div>
                  )}

                  {selectedContact.notes && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] text-slate-500 font-medium">Private Notes</p>
                      <p className="text-slate-700 mt-1 leading-relaxed whitespace-pre-wrap">
                        {selectedContact.notes}
                      </p>
                    </div>
                  )}

                  {selectedContact.tags && selectedContact.tags.length > 0 && (
                    <div>
                      <p className="text-[11px] text-slate-500 font-medium mb-1.5">Tags & Groups</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedContact.tags.map((t) => (
                          <span
                            key={t}
                            className="text-xs font-medium bg-blue-50 text-[#0b57d0] border border-blue-100 px-2.5 py-0.5 rounded-lg"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Linked Email History */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Recent Messages ({linkedEmails.length})
                  </h4>
                </div>

                {linkedEmails.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    No recent thread history with this contact.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {linkedEmails.slice(0, 4).map((msg) => (
                      <div
                        key={msg.id}
                        onClick={() => onComposeTo(selectedContact.email, selectedContact.name)}
                        className="p-3 bg-white border border-slate-200 hover:border-blue-300 rounded-xl cursor-pointer transition-all hover:shadow-xs group"
                      >
                        <p className="text-xs font-semibold text-slate-900 truncate group-hover:text-[#0b57d0]">
                          {msg.subject || '(No Subject)'}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{msg.text}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {msg.formattedTime || msg.relativeTime || 'Recent'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <button
                onClick={(e) => handleOpenEditModal(selectedContact, e)}
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Info</span>
              </button>
              <button
                onClick={(e) => handleDelete(selectedContact.id, e)}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Contact Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            id="contact-modal"
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-[#0b57d0] flex items-center justify-center font-bold text-xs">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingContact ? 'Edit Contact' : 'Create New Contact'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveContact} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Full name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b57d0]/20 focus:border-[#0b57d0]"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b57d0]/20 focus:border-[#0b57d0]"
                  />
                </div>

                {/* Company */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company / Org</label>
                  <input
                    type="text"
                    placeholder="e.g. InnovateCorp Systems"
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b57d0]/20 focus:border-[#0b57d0]"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title / Role</label>
                  <input
                    type="text"
                    placeholder="e.g. VP of Product Strategy"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b57d0]/20 focus:border-[#0b57d0]"
                  />
                </div>

                {/* Phone */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. +1 (555) 349-8821"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b57d0]/20 focus:border-[#0b57d0]"
                  />
                </div>
              </div>

              {/* Tags & Categorization */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tags & Category
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {popularTags.map((t) => {
                    const isSelected = formTags.includes(t);
                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => toggleTagSelection(t)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                          isSelected
                            ? 'bg-[#0b57d0] text-white border-[#0b57d0]'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {t}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  placeholder="Type custom tag and press Enter..."
                  value={formTagInput}
                  onChange={(e) => setFormTagInput(e.target.value)}
                  onKeyDown={handleAddCustomTag}
                  className="w-full px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b57d0]/20 focus:border-[#0b57d0]"
                />
              </div>

              {/* Private Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Private Notes</label>
                <textarea
                  rows={3}
                  placeholder="Add context, past conversation takeaways, or relationship reminders..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b57d0]/20 focus:border-[#0b57d0] resize-none"
                />
              </div>

              {/* Mark as Favorite */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="mark-favorite-chk"
                  checked={formIsFavorite}
                  onChange={(e) => setFormIsFavorite(e.target.checked)}
                  className="rounded text-[#0b57d0] focus:ring-[#0b57d0] h-4 w-4 border-slate-300"
                />
                <label htmlFor="mark-favorite-chk" className="text-xs font-medium text-slate-700 select-none">
                  Star as Favorite (Pin to quick access)
                </label>
              </div>

              {/* Modal Footer */}
              <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-[#0b57d0] hover:bg-[#0848b0] text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-2"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingContact ? 'Update Contact' : 'Save Contact'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
