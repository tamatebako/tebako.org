export const SITE = {
  name: 'Tebako',
  title: 'Tebako — The jewel box for Ruby',
  description:
    'Tebako packages Ruby applications into self-contained, cross-platform executables. One file, zero dependencies, every platform.',
  url: 'https://www.tebako.org',
  tagline: 'The jewel box for Ruby.',
  github: 'https://github.com/tamatebako/tebako',
  samplesRepo: 'https://github.com/tamatebako/tebako-samples',
  docs: '/docs/',
  contactEmail: 'open.source@ribose.com',
  legal: {
    name: 'Ribose Group Inc.',
    tos: 'https://www.ribose.com/tos',
    privacy: 'https://www.ribose.com/privacy',
  },
}

export interface NavItem {
  label: string
  href: string
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Features', href: '/features/' },
  { label: 'Architecture', href: '/architecture/' },
  { label: 'Blog', href: '/blog/' },
  { label: 'FAQ', href: '/faq/' },
  { label: 'About', href: '/about/' },
]

export const FOOTER_LINKS = {
  Project: [
    { label: 'Features', href: '/features/' },
    { label: 'Architecture', href: '/architecture/' },
    { label: 'FAQ', href: '/faq/' },
    { label: 'About', href: '/about/' },
  ],
  Resources: [
    { label: 'Blog', href: '/blog/' },
    { label: 'GitHub', href: SITE.github },
    { label: 'Samples', href: SITE.samplesRepo },
    { label: 'Documentation', href: SITE.docs },
  ],
  Community: [
    { label: 'Report an issue', href: `${SITE.github}/issues` },
    { label: 'Ribose Inc.', href: 'https://www.ribose.com' },
    { label: 'Terms of Service', href: SITE.legal.tos },
    { label: 'Privacy Policy', href: SITE.legal.privacy },
  ],
}
