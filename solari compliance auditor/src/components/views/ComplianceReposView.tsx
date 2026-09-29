import React, { useState } from 'react';

interface ComplianceReposViewProps {
  initialRepo: 'regulatory-ftc' | 'regulatory-gdpr' | 'regulatory-ccpa' | 'regulatory-popia' | 'regulatory-lesotho-dpa';
}

export const ComplianceReposView: React.FC<ComplianceReposViewProps> = ({ initialRepo }) => {
  const [selectedRepo, setSelectedRepo] = useState(initialRepo);

  const repos = {
    'regulatory-ftc': {
      title: 'Federal Trade Commission (FTC) Enforcement Repository',
      code: 'FTC Title 16 CFR § 314',
      badge: 'US Federal Standard',
      description:
        'Standards for Safeguarding Customer Information under the Gramm-Leach-Bliley Act (GLBA) and FTC Act Section 5 unfair practices directives.',
      sections: [
        {
          num: '16 CFR § 314.4(e)',
          title: 'Overseeing Service Providers',
          text: 'Requires that financial institutions and contracted processors take reasonable steps to select and retain service providers that are capable of maintaining appropriate safeguards for customer information; and contractually require service providers to implement and maintain such safeguards.',
          mandatoryLanguage: '“...contractually require service providers to implement and maintain administrative, technical, and physical safeguards...”',
        },
        {
          num: '16 CFR § 314.4(c)',
          title: 'Design and Implementation of Safeguards',
          text: 'Mandates access controls, authentication factors, data encryption in transit and at rest, secure software development practices, and multi-factor authentication (MFA) for any individual accessing customer data systems.',
          mandatoryLanguage: '“...encrypt all customer information at rest and in transit; implement multi-factor authentication...”',
        },
        {
          num: '16 CFR § 314.4(h)',
          title: 'Incident Response Plan & Notification',
          text: 'Requires a documented incident response plan with clear roles, responsibilities, decision-making processes, and swift breach notice windows.',
          mandatoryLanguage: '“...written notification within 30 days of discovery of unauthorized acquisition of unencrypted customer information...”',
        },
      ],
    },
    'regulatory-gdpr': {
      title: 'EU General Data Protection Regulation Directives',
      code: 'Regulation (EU) 2016/679',
      badge: 'European Union Standard',
      description:
        'Comprehensive framework governing the processing of personal data, processor contracts, cross-border transfers, and security mandates.',
      sections: [
        {
          num: 'Article 28(3)',
          title: 'Processor Contractual Mandates',
          text: 'Processing by a processor shall be governed by a binding contract stipulating subject-matter, duration, nature and purpose of processing, type of personal data and categories of data subjects.',
          mandatoryLanguage: '“...processor shall process the personal data only on documented instructions from the controller, including with regard to transfers...”',
        },
        {
          num: 'Article 32',
          title: 'Security of Processing',
          text: 'Taking into account the state of the art, the costs of implementation and the nature of processing, the controller and processor shall implement appropriate technical and organisational measures.',
          mandatoryLanguage: '“...pseudonymisation and encryption; ability to ensure ongoing confidentiality, integrity, availability...”',
        },
        {
          num: 'Article 33 / 34',
          title: 'Breach Notification Timeline',
          text: 'Notification to the supervisory authority must occur without undue delay and, where feasible, not later than 72 hours after having become aware of it.',
          mandatoryLanguage: '“...not later than 72 hours after having become aware of it, unless the breach is unlikely to result in a risk...”',
        },
      ],
    },
    'regulatory-ccpa': {
      title: 'California Consumer Privacy Act & CPRA Provisions',
      code: 'Cal. Civ. Code § 1798.100 - 1798.199',
      badge: 'California State Standard',
      description:
        'Enacted privacy covenants restricting service providers from retaining, using, or disclosing consumer personal information for any purpose other than business purposes specified in the contract.',
      sections: [
        {
          num: 'Cal. Civ. Code § 1798.140(ag)',
          title: 'Service Provider Definition & Contract Terms',
          text: 'The contract must prohibit the person receiving the personal information from selling or sharing personal information, or retaining it outside the direct business relationship.',
          mandatoryLanguage: '“...certifies that the person understands the restrictions in subparagraph (A) and will comply with them...”',
        },
        {
          num: 'Cal. Civ. Code § 1798.105',
          title: 'Consumers Right to Deletion',
          text: 'Service providers must promptly delete personal information upon verified consumer request forwarded by the business entity.',
          mandatoryLanguage: '“...direct service providers to delete the consumer’s personal information from their records...”',
        },
      ],
    },
    'regulatory-popia': {
      title: 'South African Protection of Personal Information Act (POPIA)',
      code: 'POPIA Act No. 4 of 2013 / Information Regulator Regulations',
      badge: '🇿🇦 South Africa (ZA)',
      description:
        'Governs lawful processing of personal information by responsible parties and operators in South Africa, mandating strict security measures, operator agreements, and breach notifications to the Information Regulator.',
      sections: [
        {
          num: 'POPIA Section 19',
          title: 'Security Measures on Integrity and Confidentiality',
          text: 'A responsible party must secure the integrity and confidentiality of personal information in its possession or under its control by taking appropriate, reasonable technical and organisational measures to prevent loss of, damage to or unauthorised destruction of personal information; and unlawful access to or processing of personal information.',
          mandatoryLanguage: '“...identify all reasonably foreseeable internal and external risks; establish and maintain appropriate safeguards; regularly verify that safeguards are effectively implemented...”',
        },
        {
          num: 'POPIA Section 21',
          title: 'Operator Processing Mandates & Written Contracts',
          text: 'An operator or anyone processing personal information on behalf of a responsible party must process such information only with the knowledge or authorisation of the responsible party; and treat personal information which comes to their knowledge as confidential. The responsible party must ensure that the operator establishes and maintains security measures referred to in section 19 under a mandatory written agreement.',
          mandatoryLanguage: '“...must ensure that the operator establishes and maintains the security measures referred to in section 19... governed by a written contract...”',
        },
        {
          num: 'POPIA Section 22',
          title: 'Notification of Security Compromises (Breach Notice)',
          text: 'Where there are reasonable grounds to believe that the personal information of a data subject has been accessed or acquired by any unauthorised person, the responsible party must notify the Information Regulator and the data subject as soon as reasonably possible after the discovery of the compromise.',
          mandatoryLanguage: '“...must notify the Regulator and the data subject as soon as reasonably possible after discovery, with sufficient information to allow protective measures...”',
        },
        {
          num: 'POPIA Section 72',
          title: 'Transborder Information Flows (Cross-Border SADC / International)',
          text: 'A responsible party in South Africa may not transfer personal information about a data subject to a third party in a foreign country unless the recipient is subject to a law, binding corporate rules or binding agreement which provide an adequate level of protection.',
          mandatoryLanguage: '“...recipient is subject to a law or binding agreement providing an adequate level of protection substantially similar to the principles in POPIA...”',
        },
      ],
    },
    'regulatory-lesotho-dpa': {
      title: 'Kingdom of Lesotho Data Protection & Communications Framework',
      code: 'Data Protection Act 2012 (Act No. 5 of 2012) & Communications Act 2012',
      badge: '🇱🇸 Lesotho (LS)',
      description:
        'National statutory framework enacted by the Parliament of Lesotho to protect personal data, regulate automated processing, establish rights of data subjects, and govern lawful interception and telecommunications standards.',
      sections: [
        {
          num: 'DPA 2012 Section 14 & 15',
          title: 'Principles of Lawful Processing & Security Safeguards',
          text: 'A data controller must take appropriate technical and organisational measures to safeguard data against accidental or unauthorised destruction, loss, alteration, or disclosure. In contracting data processors, the controller must ensure compliance with security safeguards under a legally enforceable agreement.',
          mandatoryLanguage: '“...ensure that the data processor provides sufficient guarantees in respect of technical and organisational security measures...”',
        },
        {
          num: 'DPA 2012 Section 24',
          title: 'Transborder Data Flow Restrictions (SADC Harmonization)',
          text: 'Prohibits the transfer of personal data across the borders of the Kingdom of Lesotho unless the receiving state or territory guarantees an adequate level of data protection consistent with SADC Model Laws or under express bilateral contractual covenants.',
          mandatoryLanguage: '“...transfer prohibited unless the foreign recipient country provides an adequate level of protection for the rights of the data subject...”',
        },
        {
          num: 'Communications Act 2012 § 48',
          title: 'Confidentiality & Lawful Interception by Licensees',
          text: 'Requires all communications licensees and network operators in Lesotho to preserve the confidentiality of transmitted electronic communications, restricting retention and surveillance except under lawful court warrant issued by the High Court of Lesotho.',
          mandatoryLanguage: '“...licensee shall not intercept, monitor, or disclose customer communications without lawful authorisation under court warrant...”',
        },
        {
          num: 'Labour Code Order 1992 (Order 24)',
          title: 'Employment Protections & Restraint of Trade Covenants',
          text: 'Governs fair employment relationships in Lesotho. Statutory provisions restrict punitive restraint of trade covenants, arbitrary termination, and deductions without prior statutory consent.',
          mandatoryLanguage: '“...no deduction shall be made from the wages of an employee except where specifically authorised by statutory code or written employee consent...”',
        },
      ],
    },
  };

  const activeData = repos[selectedRepo];

  return (
    <div className="flex flex-col w-full pb-8 space-y-4">
      {/* Header Tabs */}
      <div className="bg-[#222a3d] border border-[#334155]/80 rounded-xl p-4 shadow-md flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-base font-semibold text-[#dae2fd] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#7bd0ff] text-[20px]">policy</span>
            Regulatory Knowledge Repositories &amp; Safe Harbors
          </h1>
          <p className="text-xs text-[#d8c3ad] mt-0.5">
            Indexed vector database of statutory compliance standards used by BrowserSurface and Sandbox matcher.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSelectedRepo('regulatory-ftc')}
            className={`px-3 py-1 rounded font-mono text-xs transition-colors ${
              selectedRepo === 'regulatory-ftc'
                ? 'bg-[#7bd0ff] text-[#00354a] font-semibold'
                : 'bg-[#171f33] text-[#d8c3ad] hover:bg-[#222a3d] border border-[#334155]'
            }`}
          >
            FTC Repository
          </button>
          <button
            onClick={() => setSelectedRepo('regulatory-gdpr')}
            className={`px-3 py-1 rounded font-mono text-xs transition-colors ${
              selectedRepo === 'regulatory-gdpr'
                ? 'bg-[#7bd0ff] text-[#00354a] font-semibold'
                : 'bg-[#171f33] text-[#d8c3ad] hover:bg-[#222a3d] border border-[#334155]'
            }`}
          >
            GDPR Directives
          </button>
          <button
            onClick={() => setSelectedRepo('regulatory-ccpa')}
            className={`px-3 py-1 rounded font-mono text-xs transition-colors ${
              selectedRepo === 'regulatory-ccpa'
                ? 'bg-[#7bd0ff] text-[#00354a] font-semibold'
                : 'bg-[#171f33] text-[#d8c3ad] hover:bg-[#222a3d] border border-[#334155]'
            }`}
          >
            CCPA Provisions
          </button>
          <button
            onClick={() => setSelectedRepo('regulatory-popia')}
            className={`px-3 py-1 rounded font-mono text-xs transition-colors ${
              selectedRepo === 'regulatory-popia'
                ? 'bg-[#10b981] text-[#062c1d] font-semibold'
                : 'bg-[#171f33] text-[#d8c3ad] hover:bg-[#222a3d] border border-[#334155]'
            }`}
          >
            🇿🇦 POPIA (South Africa)
          </button>
          <button
            onClick={() => setSelectedRepo('regulatory-lesotho-dpa')}
            className={`px-3 py-1 rounded font-mono text-xs transition-colors ${
              selectedRepo === 'regulatory-lesotho-dpa'
                ? 'bg-[#ffc174] text-[#3e2400] font-semibold'
                : 'bg-[#171f33] text-[#d8c3ad] hover:bg-[#222a3d] border border-[#334155]'
            }`}
          >
            🇱🇸 DPA 2012 (Lesotho)
          </button>
        </div>
      </div>

      {/* Repo Detail Card */}
      <div className="bg-[#171f33] border border-[#222a3d] rounded-xl p-4 shadow-sm">
        <div className="flex justify-between items-start pb-3 mb-3 border-b border-[#222a3d]">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[#ffc174] font-semibold">
                {activeData.code}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#060e20] text-[#7bd0ff] font-mono text-[10px] border border-[#334155]">
                {activeData.badge}
              </span>
            </div>
            <h2 className="text-sm font-semibold text-[#dae2fd] mt-1">{activeData.title}</h2>
            <p className="text-xs text-[#d8c3ad] mt-1 max-w-3xl">{activeData.description}</p>
          </div>
          <span className="font-mono text-[10px] text-[#10b981] bg-[#10b981]/10 px-2 py-1 rounded border border-[#10b981]/30">
            AST EMBEDDED
          </span>
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {activeData.sections.map((sec, idx) => (
            <div
              key={idx}
              className="bg-[#060e20] border border-[#222a3d] rounded-lg p-3 space-y-2 font-mono"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-[#ffc174]">{sec.num}</span>
                <span className="text-xs font-medium text-[#dae2fd] font-sans">{sec.title}</span>
              </div>
              <p className="text-xs text-[#d8c3ad] font-sans leading-relaxed">{sec.text}</p>
              <div className="bg-[#171f33] p-2 rounded text-[11px] text-[#7bd0ff] border border-[#334155]/60">
                <span className="text-[#ffc174] font-semibold font-mono">Enforcement Benchmark: </span>
                {sec.mandatoryLanguage}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
