/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-composer-to-package-src',
      comment: 'Composer must import via package name, not other packages src',
      from: { path: '^packages/composer/' },
      to: { path: '^packages/(core|kernel|theory|synaptic)/src/' },
      severity: 'error',
    },
    {
      name: 'no-synaptic-to-package-src',
      comment: 'Synaptic must import via package name, not other packages src',
      from: { path: '^packages/synaptic/' },
      to: { path: '^packages/(kernel|theory)/src/' },
      severity: 'error',
    },
    {
      name: 'no-web-to-package-src',
      comment: 'Web must import via package name, not other packages src',
      from: { path: '^packages/web/' },
      to: { path: '^packages/(kernel|dsp)/src/' },
      severity: 'error',
    },
    {
      name: 'no-synthesis-to-package-src',
      comment: 'Synthesis must import via package name, not other packages src',
      from: { path: '^packages/synthesis/' },
      to: { path: '^packages/dsp/src/' },
      severity: 'error',
    },
  ],
  options: {
    doNotFollow: {
      path: ['node_modules', 'dist'],
    },
  },
};
