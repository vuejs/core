import { mount } from '@vue/test-utils';
import VersionSelect from './VersionSelect.vue';

describe('VersionSelect component safely handles external manifest data', () => {
  const adversarialPayloads = [
    // Exact exploit case: malicious JavaScript injection in manifest
    JSON.stringify({
      versions: ['1.0.0'],
      scripts: ['<script>alert("xss")</script>', 'javascript:alert(1)']
    }),
    // Boundary case: deeply nested malicious payload
    JSON.stringify({
      versions: [],
      meta: {
        scripts: {
          src: "data:text/javascript,evil()",
          onload: "alert('exploit')"
        }
      }
    }),
    // Valid input (should pass through safely)
    JSON.stringify({
      versions: ['1.0.0', '1.1.0'],
      scripts: []
    })
  ];

  test.each(adversarialPayloads)(
    'sanitizes or safely handles manifest data: %s',
    async (payload) => {
      // Mock fetch to return adversarial payload
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(JSON.parse(payload))
        })
      ) as jest.Mock;

      const wrapper = mount(VersionSelect);
      
      // Trigger manifest fetch
      await wrapper.vm.fetchVersions();
      
      // Security property: No raw untrusted data should be directly assigned to DOM
      // Check that component doesn't directly inject unescaped payload into template
      const html = wrapper.html();
      
      // Assert no raw script tags or dangerous protocols appear in rendered output
      expect(html).not.toContain('<script>alert("xss")</script>');
      expect(html).not.toContain('javascript:alert(1)');
      expect(html).not.toContain('data:text/javascript,evil()');
      
      // Clean up mock
      (global.fetch as jest.Mock).mockClear();
    }
  );
});