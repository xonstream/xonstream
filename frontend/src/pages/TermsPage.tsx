import React from 'react';

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-16 animate-fade-in">
      {/* Background glow effects */}
      <div className="absolute top-20 left-1/4 w-72 h-72 bg-accent/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-80 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header section */}
      <div className="text-center mb-10 md:mb-12 relative">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4 tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text">
          Terms of Use
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm text-muted-foreground font-medium">
          <span className="px-3 py-1 bg-secondary rounded-full border border-border">Website: <span className="text-accent font-semibold">xonstream.qzz.io</span></span>
          <span className="px-3 py-1 bg-secondary rounded-full border border-border">Effective Date: June 2026</span>
        </div>
      </div>

      {/* Adult Content Warning */}
      <div className="mb-10 p-6 sm:p-8 bg-destructive/10 border-2 border-destructive/20 rounded-2xl relative overflow-hidden backdrop-blur-sm shadow-[0_0_50px_-12px_rgba(239,68,68,0.15)]">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-destructive" />
        <h2 className="text-xl sm:text-2xl font-bold text-destructive mb-4 flex items-center gap-2">
          ⚠️ Adult Content Warning
        </h2>
        <p className="text-foreground font-medium mb-4 text-sm sm:text-base">
          XONSTREAM is an adult-oriented website that contains sexually explicit material intended solely for consenting adults.
        </p>
        <p className="text-muted-foreground text-sm mb-6">
          By accessing, viewing, browsing, or using this Website, you confirm that:
        </p>
        <ul className="space-y-3">
          {[
            'You are at least 18 years old, or the age of majority required by the laws of your jurisdiction (21+ where applicable).',
            'You have the legal right to access adult material in your location.',
            'You understand the nature of the content available on this Website.',
            'You will not permit any minor to access the Website through your account, device, or internet connection.'
          ].map((item, idx) => (
            <li key={idx} className="flex gap-3 text-sm text-foreground/90 leading-relaxed">
              <span className="flex-shrink-0 text-destructive mt-1 font-bold">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 pt-4 border-t border-destructive/10 text-xs sm:text-sm text-destructive/80 font-medium">
          If you do not meet these requirements, you must leave the Website immediately.
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="space-y-8 relative">
        {[
          {
            title: '1. Acceptance of Terms',
            content: 'These Terms of Use constitute a legally binding agreement between you ("User") and XONSTREAM ("Website", "Service", "We", "Us", or "Our").',
            sub: 'By accessing or using XONSTREAM, you agree to comply with and be bound by these Terms of Use. If you disagree with any provision of these Terms, you must discontinue use of the Website immediately.'
          },
          {
            title: '2. Eligibility & Age Verification',
            content: 'You represent and warrant that:',
            bullets: [
              'You are legally an adult in your jurisdiction.',
              'You are not prohibited from accessing adult content by local law.',
              'All information you provide is truthful and accurate.',
              'You understand that falsely claiming legal age may violate applicable laws.'
            ],
            extra: 'XONSTREAM reserves the right to request age verification when necessary. Failure to provide valid verification may result in account suspension or termination.'
          },
          {
            title: '3. Nature of the Service',
            content: 'XONSTREAM provides access to adult entertainment content, streaming media, community features, and other related services.',
            sub: 'The Website may contain:',
            bullets: [
              'Explicit sexual content',
              'Adult-oriented imagery',
              'Adult videos',
              'User-submitted content',
              'Third-party content'
            ],
            extra: 'Users access such material entirely at their own discretion and risk.'
          },
          {
            title: '4. License to Use the Website',
            content: 'Subject to these Terms, XONSTREAM grants you a limited, revocable, non-exclusive, non-transferable license to:',
            bullets: [
              'Access the Website.',
              'Stream content.',
              'Use Website features for personal and non-commercial purposes.'
            ],
            extra: 'This license does not transfer ownership of any Website content.'
          },
          {
            title: '5. Prohibited Conduct',
            content: 'You agree NOT to:',
            bullets: [
              'Violate any applicable law.',
              'Circumvent age verification systems.',
              'Use automated bots, crawlers, or scrapers.',
              'Reverse engineer Website systems.',
              'Interfere with Website security.',
              'Upload malware, spyware, or viruses.',
              'Attempt unauthorized access to Website systems.',
              'Collect personal information of other users.',
              'Use the Website for fraud, harassment, or unlawful activity.'
            ],
            extra: 'Violation may result in immediate account termination and legal action.'
          },
          {
            title: '6. User Content Rules',
            content: 'Where content submission is allowed, users remain solely responsible for any content they upload, publish, transmit, or distribute.',
            sub: 'You warrant that:',
            bullets: [
              'You own the content or possess all necessary rights.',
              'You have obtained all required permissions and releases.',
              'Your content does not violate any law.',
              'Your content does not infringe copyrights, trademarks, privacy rights, or other legal rights.'
            ]
          },
          {
            title: '7. Adult Content Compliance',
            content: 'Any user submitting adult content represents and warrants that:',
            bullets: [
              'Every individual depicted is at least 18 years old or the legal age required by law.',
              'All individuals consented to the recording.',
              'All individuals consented to publication and distribution.',
              'Valid age-verification records exist for all participants.',
              'The content complies with all applicable laws and regulations.'
            ],
            extra: 'XONSTREAM maintains a zero-tolerance policy toward illegal content.'
          },
          {
            title: '8. Strictly Prohibited Content',
            content: 'The following content is strictly forbidden:',
            bullets: [
              'Child sexual abuse material (CSAM)',
              'Any content involving minors',
              'Non-consensual sexual content',
              'Revenge pornography',
              'Human trafficking content',
              'Coercive sexual content',
              'Bestiality',
              'Illegal violent sexual content',
              'Copyright-infringing material',
              'Fraudulent content',
              'Deepfake content impersonating real persons without authorization',
              'Content violating applicable laws'
            ],
            extra: 'Any such content may be removed immediately and reported to appropriate authorities.'
          },
          {
            title: '9. Content Removal & Reporting',
            content: 'Users may report content believed to be:',
            bullets: [
              'Illegal',
              'Unauthorized',
              'Copyright infringing',
              'Non-consensual',
              'Fraudulent'
            ],
            extra: 'XONSTREAM reserves the right to remove content at its sole discretion without notice.'
          },
          {
            title: '10. Intellectual Property Rights',
            content: 'All Website materials including:',
            bullets: [
              'Logos',
              'Trademarks',
              'Graphics',
              'Software',
              'Designs',
              'Text',
              'Videos',
              'Branding'
            ],
            sub: 'are owned by XONSTREAM or its licensors and are protected under applicable intellectual property laws.',
            extra: 'Users may not: Copy, republish, redistribute, sell Website content, or create derivative works without prior written authorization.'
          },
          {
            title: '11. Copyright Policy',
            content: 'XONSTREAM respects intellectual property rights and complies with applicable copyright laws.',
            sub: 'Copyright owners may submit notices regarding allegedly infringing content. We reserve the right to:',
            bullets: [
              'Remove content.',
              'Restrict access.',
              'Terminate repeat infringers.'
            ]
          },
          {
            title: '12. Third-Party Websites',
            content: 'The Website may contain links to third-party services and websites.',
            sub: 'XONSTREAM does not control third-party websites, does not endorse third-party content, and is not responsible for third-party actions.',
            extra: 'Accessing third-party services is entirely at your own risk.'
          },
          {
            title: '13. Privacy',
            content: 'Your use of XONSTREAM is subject to our Privacy Policy.',
            sub: 'By using the Website, you consent to the collection, processing, and storage of information in accordance with our Privacy Policy.'
          },
          {
            title: '14. Service Availability',
            content: 'XONSTREAM may modify services, suspend services, restrict access, remove content, or discontinue features at any time without prior notice.',
            sub: 'We do not guarantee uninterrupted service availability.'
          },
          {
            title: '15. Disclaimer of Warranties',
            content: 'The Website is provided on an "AS IS" and "AS AVAILABLE" basis.',
            sub: 'To the fullest extent permitted by law, XONSTREAM disclaims all warranties including merchantability, fitness for a particular purpose, accuracy, reliability, availability, and non-infringement.',
            extra: 'Use of the Website is entirely at your own risk.'
          },
          {
            title: '16. Limitation of Liability',
            content: 'To the fullest extent permitted by law, XONSTREAM shall not be liable for direct, indirect, special, incidental, consequential damages, loss of profits, loss of data, or business interruption arising from use of the Website.'
          },
          {
            title: '17. Indemnification',
            content: 'You agree to indemnify and hold harmless XONSTREAM, its owners, employees, affiliates, partners, contractors, and licensors from any claims, liabilities, damages, losses, costs, or expenses arising from:',
            bullets: [
              'Your use of the Website.',
              'Your violation of these Terms.',
              'Your violation of any law.',
              'Your submitted content.'
            ]
          },
          {
            title: '18. Termination',
            content: 'We reserve the right to suspend, restrict, or terminate access to the Website at any time and for any reason, including violations of these Terms.',
            sub: 'Termination may occur without prior notice.'
          },
          {
            title: '19. Governing Law',
            content: 'These Terms shall be governed and interpreted under applicable laws.',
            sub: 'Any disputes arising from use of the Website shall be resolved in the appropriate courts having jurisdiction over the matter.'
          },
          {
            title: '20. Contact Information',
            content: 'For legal inquiries, abuse reports, copyright notices, content removal requests, or general support, please use the contact methods available on the Website.',
            extra: 'Website Name: XONSTREAM | Website URL: xonstream.qzz.io'
          }
        ].map((sec, index) => (
          <div 
            key={index} 
            className="p-6 bg-card/40 border border-border rounded-xl backdrop-blur-sm hover:border-border/80 transition-colors"
          >
            <h3 className="text-lg font-bold text-foreground mb-3 flex items-center">
              {sec.title}
            </h3>
            
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              {sec.content}
            </p>
            
            {sec.sub && (
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                {sec.sub}
              </p>
            )}
            
            {sec.bullets && (
              <ul className="space-y-2 mb-3 pl-4">
                {sec.bullets.map((b, bIdx) => (
                  <li key={bIdx} className="flex gap-2 text-sm text-muted-foreground leading-relaxed">
                    <span className="text-accent">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
            
            {sec.extra && (
              <p className="text-sm font-medium text-foreground/80 border-t border-border/50 pt-3 mt-3">
                {sec.extra}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Footer Acknowledgment */}
      <div className="mt-12 p-6 bg-secondary/40 border border-border rounded-xl text-center">
        <h4 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">
          User Acknowledgment
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          BY ACCESSING, USING, VIEWING, STREAMING, OR OTHERWISE INTERACTING WITH XONSTREAM, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREED TO THESE TERMS OF USE AND THAT YOU ARE OF LEGAL AGE TO ACCESS ADULT CONTENT IN YOUR JURISDICTION.
        </p>
      </div>
    </div>
  );
}
