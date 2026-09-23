const fs = require('fs');
let yaml = fs.readFileSync('lib/api-spec/openapi.yaml', 'utf8');

yaml = yaml.replace(
  '    ApprovalSlaInput:\n      type: object\n      properties:\n        subjectSnapshotHash: { type: string }\n        dueAt: { type: string }\n        warningAt: { type: string }',
  '    ApprovalSlaInput:\n      type: object\n      properties:\n        subjectSnapshotHash: { type: string }\n        dueAt: { type: string }\n        warningAt: { type: string }\n        escalationAt: { type: string }'
);

fs.writeFileSync('lib/api-spec/openapi.yaml', yaml);
