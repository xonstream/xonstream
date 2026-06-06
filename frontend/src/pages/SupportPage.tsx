import React, { useState } from 'react';
import { submitSupportRequest } from '@/lib/api';
import { toast } from 'sonner';
import { Mail, User, FileText, Send, HelpCircle, Bug, MessageSquare } from 'lucide-react';
import Loader from '@/components/Loader';

type RequestType = 'general' | 'bug' | 'request';

export default function SupportPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [requestType, setRequestType] = useState<RequestType>('general');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim() || !description.trim()) {
      toast.error('All fields are required.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Append the request type to the description to store it nicely
      const fullDescription = `[Type: ${requestType.toUpperCase()}] ${description.trim()}`;
      
      const response = await submitSupportRequest(
        fullName.trim(),
        email.trim(),
        fullDescription
      );

      if (response.success) {
        toast.success('Your message has been sent successfully!');
        setFullName('');
        setEmail('');
        setDescription('');
      } else {
        toast.error(response.message || 'Failed to send message.');
      }
    } catch (error: any) {
      console.error('Support submit error:', error);
      toast.error(error.message || 'Unable to connect to server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 md:py-16 animate-fade-in relative">
      {/* Background decoration glows */}
      <div className="absolute top-10 left-1/4 w-60 h-60 bg-accent/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-72 h-72 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Page Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-extrabold text-foreground mb-3 tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text">
          Support & Contact
        </h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
          Have a question, found a bug, or want to make a content request? Send us a message and we'll get back to you.
        </p>
      </div>

      {/* Main Support Box Container */}
      <div className="bg-card/40 border border-border rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-xl relative overflow-hidden">
        
        {/* Form selection tabs for Request Type */}
        <div className="grid grid-cols-3 gap-2 mb-8">
          {[
            { id: 'general', label: 'Contact', icon: MessageSquare, color: 'text-primary bg-primary/10 border-primary/20' },
            { id: 'bug', label: 'Report Bug', icon: Bug, color: 'text-destructive bg-destructive/10 border-destructive/20' },
            { id: 'request', label: 'Request', icon: HelpCircle, color: 'text-accent bg-accent/10 border-accent/20' }
          ].map(t => {
            const Icon = t.icon;
            const isSelected = requestType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setRequestType(t.id as RequestType)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-2 px-3 py-3 rounded-xl border text-xs sm:text-sm font-medium transition-all ${
                  isSelected 
                    ? 'bg-secondary text-foreground border-border/80 ring-2 ring-accent/30 shadow-inner' 
                    : 'bg-secondary/30 text-muted-foreground border-border/40 hover:bg-secondary/50 hover:text-foreground'
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? 'text-accent' : 'text-muted-foreground'}`} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Contact Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name */}
          <div className="relative">
            <label className="text-xs sm:text-sm font-semibold text-foreground/80 block mb-1.5 pl-1">
              FULL NAME
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Enter your name"
                disabled={isSubmitting}
                className="w-full pl-10 pr-4 py-2.5 bg-secondary/50 border border-border rounded-[24px] text-foreground text-sm outline-none transition-all focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50"
              />
            </div>
          </div>

          {/* Email */}
          <div className="relative">
            <label className="text-xs sm:text-sm font-semibold text-foreground/80 block mb-1.5 pl-1">
              EMAIL ADDRESS
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={isSubmitting}
                className="w-full pl-10 pr-4 py-2.5 bg-secondary/50 border border-border rounded-[24px] text-foreground text-sm outline-none transition-all focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50"
              />
            </div>
          </div>

          {/* Description */}
          <div className="relative">
            <label className="text-xs sm:text-sm font-semibold text-foreground/80 block mb-1.5 pl-1">
              DESCRIPTION
            </label>
            <div className="relative">
              <FileText className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={`Describe your ${requestType} here...`}
                rows={5}
                disabled={isSubmitting}
                className="w-full pl-10 pr-4 py-3 bg-secondary/50 border border-border rounded-2xl text-foreground text-sm outline-none transition-all focus:ring-2 focus:ring-accent focus:border-transparent resize-none disabled:opacity-50"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-white rounded-[24px] text-sm font-bold shadow-lg hover:shadow-accent/20 hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmitting ? (
                <>
                  <Loader size="small" />
                  <span>Sending Message...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Message</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
