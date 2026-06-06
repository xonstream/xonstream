import React from 'react';

export default function USC2257Page() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-16 animate-fade-in">
      {/* Background glow effects */}
      <div className="absolute top-20 left-1/3 w-72 h-72 bg-accent/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-60 right-1/3 w-80 h-80 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header section */}
      <div className="text-center mb-10 md:mb-12 relative">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4 tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text">
          18 U.S.C. § 2257 Compliance Statement
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm text-muted-foreground font-medium">
          <span className="px-3 py-1 bg-secondary rounded-full border border-border">Website: <span className="text-accent font-semibold">xonstream.qzz.io</span></span>
          <span className="px-3 py-1 bg-secondary rounded-full border border-border">Record Keeping Compliance</span>
        </div>
      </div>

      {/* Main statement container */}
      <div className="space-y-6 sm:space-y-8 relative">
        
        {/* Block 1: Age Declaration */}
        <div className="p-6 bg-card/40 border border-border rounded-xl backdrop-blur-sm shadow-sm">
          <h2 className="text-base sm:text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" /> Age & Visual Depiction Statement
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            All models, actors, actresses and other persons that appear in any visual depiction of actual sexually explicit conduct appearing or otherwise contained in this Website were over the age of eighteen years at the time of the creation of such depictions.
          </p>
        </div>

        {/* Block 2: Exemptions */}
        <div className="p-6 bg-card/40 border border-border rounded-xl backdrop-blur-sm shadow-sm">
          <h2 className="text-base sm:text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" /> Exemption & 28 C.F.R. 75 Statement
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            All other visual depictions displayed on this Website are exempt from the provision of 18 USC 2257 Statement and 28 C.F.R. 75 because said visual depictions do not consist of depictions of conduct as specifically listed in 18 USC 2257 Statement (2) (A) through (D), but are merely depictions of non-sexually explicit nudity, or are depictions of simulated sexual conduct, or are otherwise exempt because the visual depictions were created prior to July 3, 1995.
          </p>
        </div>

        {/* Block 3: Guarantee */}
        <div className="p-6 bg-card/40 border border-border rounded-xl backdrop-blur-sm shadow-sm">
          <h2 className="text-base sm:text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" /> General Age Guarantee
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            With respect to all visual depictions displayed on this website, whether of actual sexually explicit conduct, simulated sexual content or otherwise, all persons in said visual depictions were at least 18 years of age when said visual depictions were created.
          </p>
        </div>

        {/* Block 4: Owner Disclaimer */}
        <div className="p-6 bg-secondary/30 border border-border rounded-xl backdrop-blur-sm text-center">
          <h3 className="text-sm font-bold text-foreground mb-2 uppercase tracking-wider">
            Primary Producer Disclaimer
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            The owners and operators of this Website are not the primary producer (as that term is defined in 18 USC 2257 Statement) of any of the visual content contained in the Website.
          </p>
        </div>

      </div>
    </div>
  );
}
