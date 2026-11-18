import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = process.cwd();
const DOCS_DIR = path.join(ROOT_DIR, 'docs');

function walkFiles(dir: string, predicate: (filePath: string) => boolean): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, predicate));
    } else if (predicate(fullPath)) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

function extractRelativeMarkdownLinks(markdown: string): string[] {
  const strippedCodeBlocks = markdown.replace(/```[\s\S]*?```/g, '');
  const matches = strippedCodeBlocks.matchAll(/\[[^\]]+\]\(([^)]+)\)/g);
  const targets: string[] = [];

  for (const match of matches) {
    const rawTarget = match[1].trim();
    if (
      !rawTarget ||
      rawTarget.startsWith('#') ||
      /^(https?:|mailto:|tel:|file:|conversation:)/i.test(rawTarget)
    ) {
      continue;
    }
    const cleanTarget = rawTarget.split('#')[0].split('?')[0];
    if (cleanTarget) {
      targets.push(decodeURIComponent(cleanTarget));
    }
  }

  return targets;
}

describe('Task V-20 POS technical handover documentation and docs hygiene', () => {
  const readmePath = path.join(ROOT_DIR, 'README.md');
  const readmeContent = fs.readFileSync(readmePath, 'utf8');

  it('removes obsolete unreferenced docs while preserving all protected and active docs', () => {
    const removedObsoleteDocs = [
      'docs/prd_sistem_working_space_dago.md',
      'docs/implementation_plan.md',
      'docs/INTEGRATION_MR15.md',
    ];
    for (const relPath of removedObsoleteDocs) {
      expect(fs.existsSync(path.join(ROOT_DIR, relPath)), `${relPath} should be deleted`).toBe(false);
    }

    const requiredActiveDocs = [
      'docs/AKUN_SISTEM.md',
      'docs/ARCHITECTURE.md',
      'docs/AUDIT_PENYIMPANAN_DATA.md',
      'docs/DATABASE.md',
      'docs/DEPLOY_COOLIFY.md',
      'docs/DESIGN_SYSTEM.md',
      'docs/RBAC.md',
      'docs/REDESIGN_HANDOFF.md',
      'docs/REDESIGN_PLAYBOOK.md',
      'docs/REDESIGN_REVIEW_GEMINI.md',
      'docs/SHADCN_UI_IMPLEMENTATION_PLAN.md',
      'docs/TESTING.md',
      'docs/UNSLOP_AUDIT.md',
      'docs/test-cases/TC-S07-PAID-EVENT-E2E.md',
      'docs/test-cases/TC-V19-POS-REGRESSION-REPORT.md',
    ];
    for (const relPath of requiredActiveDocs) {
      expect(fs.existsSync(path.join(ROOT_DIR, relPath)), `${relPath} must exist`).toBe(true);
    }
  });

  it('covers all six mandatory V-20 handover topics in README.md for Ka Ari', () => {
    expect(readmeContent).toContain('V-20');
    expect(readmeContent).toContain('Ka Ari');

    expect(readmeContent).toContain('Next.js');
    expect(readmeContent).toContain('15.5.29');
    expect(readmeContent).toContain('src/middleware.ts');

    expect(readmeContent).toContain('Coolify');
    expect(readmeContent).toContain('nixpacks.toml');
    expect(readmeContent).toContain('/app/data/proofs');
    expect(readmeContent).toContain('DISABLE_DEMO_LOGIN');

    expect(readmeContent).toContain('prisma/schema.prisma');
    expect(readmeContent).toContain('system_settings');
    expect(readmeContent).toContain('pos_orders.json');
    expect(readmeContent).toContain('dagoeng_sync_outbox_v1');

    for (const account of [
      'admin@dagoeng.com',
      'owner.dago@dagoeng.com',
      'owner.kopisenja@dagoeng.com',
      'owner.dapurmama@dagoeng.com',
      'owner.manisbakery@dagoeng.com',
      'owner.warungbunarti@dagoeng.com',
      'cashier.sgr@kopisenja.com',
      'kitchen.sgr@kopisenja.com',
      'waiter.sgr@kopisenja.com',
      'Warung Bu Narti',
    ]) {
      expect(readmeContent).toContain(account);
    }

    for (let i = 1; i <= 19; i += 1) {
      const taskCode = `V-${String(i).padStart(2, '0')}`;
      expect(readmeContent).toContain(`\`${taskCode}\``);
    }

    for (const limitationMarker of [
      'qris-dago.jpeg',
      'DOKU_SIMULATION_MODE',
      '--kiosk-printing',
      'RECEIPT_NET_BEFORE_TAX',
      'etl-data-validation',
    ]) {
      expect(readmeContent).toContain(limitationMarker);
    }
  });

  it('keeps AKUN_SISTEM.md aligned with Warung Bu Narti and official test accounts', () => {
    const akunContent = fs.readFileSync(path.join(DOCS_DIR, 'AKUN_SISTEM.md'), 'utf8');
    expect(akunContent).toContain('Warung Bu Narti');
    expect(akunContent).toContain('owner.warungbunarti@dagoeng.com');
    expect(akunContent).not.toContain('Teh Nusantara');
  });

  it('matches live codebase structural counts documented in README.md', () => {
    const pageCount = walkFiles(path.join(ROOT_DIR, 'src/app'), (f) => path.basename(f) === 'page.tsx').length;
    const apiRouteCount = walkFiles(path.join(ROOT_DIR, 'src/app/api'), (f) => path.basename(f) === 'route.ts').length;
    const contextCount = fs.readdirSync(path.join(ROOT_DIR, 'src/contexts')).filter((f) => f.endsWith('.tsx')).length;
    const featureCount = fs
      .readdirSync(path.join(ROOT_DIR, 'src/features'), { withFileTypes: true })
      .filter((d) => d.isDirectory()).length;
    const prismaSchema = fs.readFileSync(path.join(ROOT_DIR, 'prisma/schema.prisma'), 'utf8');
    const prismaModelCount = (prismaSchema.match(/^model\s+\w+/gm) ?? []).length;

    expect(readmeContent).toContain(`| Halaman App Router | \`${pageCount}\` |`);
    expect(readmeContent).toContain(`| Endpoint API App Router | \`${apiRouteCount}\` |`);
    expect(readmeContent).toContain(`| Provider React Context | \`${contextCount}\` |`);
    expect(readmeContent).toContain(`| Modul fitur domain | \`${featureCount}\` |`);
    expect(readmeContent).toContain(`| Model relasional Prisma | \`${prismaModelCount}\` |`);
  });

  it('resolves every relative markdown link across README.md and tracked docs without broken targets', () => {
    const markdownFiles = [
      readmePath,
      ...walkFiles(
        DOCS_DIR,
        (f) => f.endsWith('.md') && path.basename(f) !== 'KLARIFIKASI_SETTLEMENT_MITRA.md',
      ),
    ];

    const brokenLinks: string[] = [];

    for (const mdFile of markdownFiles) {
      const content = fs.readFileSync(mdFile, 'utf8');
      const targets = extractRelativeMarkdownLinks(content);
      for (const target of targets) {
        if (target.includes('KLARIFIKASI_SETTLEMENT_MITRA.md')) {
          brokenLinks.push(`${path.relative(ROOT_DIR, mdFile)} -> untracked ${target}`);
          continue;
        }
        const resolvedTarget = target.startsWith('/')
          ? path.join(ROOT_DIR, target.slice(1))
          : path.resolve(path.dirname(mdFile), target);
        if (!fs.existsSync(resolvedTarget)) {
          brokenLinks.push(`${path.relative(ROOT_DIR, mdFile)} -> ${target}`);
        }
      }
    }

    expect(brokenLinks).toEqual([]);
  });
});
