const fs = require('fs');
let yaml = fs.readFileSync('lib/api-spec/openapi.yaml', 'utf8');

const missingPaths = \`
  /campaigns/{campaignId}/control-room/approvals:
    get:
      operationId: getCampaignControlRoomApprovals
      tags: [campaigns]
      summary: approvals
      security: [{ bearerAuth: [] }]
      parameters:
        - $ref: "#/components/parameters/campaignId"
        - name: limit
          in: query
          schema: { type: integer, minimum: 1, maximum: 25, default: 25 }
      responses:
        "200":
          description: ok
          content: { application/json: { schema: { $ref: "#/components/schemas/ControlRoomApprovalsResponse" } } }

  /campaigns/{campaignId}/control-room/approvals/{subjectType}/{subjectId}/decision:
    post:
      operationId: decideCampaignControlRoomApproval
      tags: [campaigns]
      summary: decide
      security: [{ bearerAuth: [] }]
      parameters:
        - $ref: "#/components/parameters/campaignId"
        - name: subjectType
          in: path
          required: true
          schema: { type: string }
        - name: subjectId
          in: path
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: "#/components/schemas/ApprovalDecisionInput" } } }
      responses:
        "200":
          description: ok
          content: { application/json: { schema: { $ref: "#/components/schemas/ApprovalDecisionResponse" } } }

  /campaigns/{campaignId}/control-room/approvals/{subjectType}/{subjectId}/sla:
    post:
      operationId: scheduleCampaignApprovalSla
      tags: [campaigns]
      summary: sla
      security: [{ bearerAuth: [] }]
      parameters:
        - $ref: "#/components/parameters/campaignId"
        - name: subjectType
          in: path
          required: true
          schema: { type: string }
        - name: subjectId
          in: path
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: "#/components/schemas/ApprovalSlaInput" } } }
      responses:
        "200":
          description: ok
          content: { application/json: { schema: { $ref: "#/components/schemas/ApprovalSlaResponse" } } }

  /campaigns/{campaignId}/control-room/execution-policy:
    get:
      operationId: getConditionalExecutionPolicy
      tags: [campaigns]
      summary: get policy
      security: [{ bearerAuth: [] }]
      parameters:
        - $ref: "#/components/parameters/campaignId"
      responses:
        "200":
          description: ok
          content: { application/json: { schema: { $ref: "#/components/schemas/ConditionalExecutionResponse" } } }
    post:
      operationId: createConditionalExecutionPolicy
      tags: [campaigns]
      summary: create policy
      security: [{ bearerAuth: [] }]
      parameters:
        - $ref: "#/components/parameters/campaignId"
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: "#/components/schemas/ConditionalExecutionPolicyInput" } } }
      responses:
        "201":
          description: ok
          content: { application/json: { schema: { type: object, additionalProperties: true } } }

  /campaigns/{campaignId}/control-room/execution-policy/{version}/revoke:
    post:
      operationId: revokeConditionalExecutionPolicy
      tags: [campaigns]
      summary: revoke policy
      security: [{ bearerAuth: [] }]
      parameters:
        - $ref: "#/components/parameters/campaignId"
        - name: version
          in: path
          required: true
          schema: { type: integer }
      responses:
        "200":
          description: ok
          content: { application/json: { schema: { type: object, additionalProperties: true } } }

  /campaigns/{campaignId}/control-room/conditional-executions:
    get:
      operationId: listConditionalExecutions
      tags: [campaigns]
      summary: list exec
      security: [{ bearerAuth: [] }]
      parameters:
        - $ref: "#/components/parameters/campaignId"
      responses:
        "200":
          description: ok
          content: { application/json: { schema: { $ref: "#/components/schemas/ConditionalExecutionResponse" } } }

  /realizations:
    post:
      operationId: createRealizationContract
      tags: [realization]
      summary: Create realization contract
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/RealizationContractInput" }
      responses:
        "201":
          description: Created
          content: { application/json: { schema: { $ref: "#/components/schemas/RealizationContract" } } }
    get:
      operationId: listRealizationContracts
      tags: [realization]
      summary: List realization contracts
      security: [{ bearerAuth: [] }]
      parameters:
        - name: campaignId
          in: query
          schema: { type: string, format: uuid }
      responses:
        "200":
          description: List of contracts
          content: { application/json: { schema: { type: array, items: { $ref: "#/components/schemas/RealizationContract" } } } }

  /realizations/{id}:
    get:
      operationId: getRealizationContract
      tags: [realization]
      summary: Get contract
      security: [{ bearerAuth: [] }]
      parameters: [{ name: id, in: path, required: true, schema: { type: string, format: uuid } }]
      responses:
        "200":
          description: Contract
          content: { application/json: { schema: { $ref: "#/components/schemas/RealizationContractDetail" } } }

  /realizations/{id}/preflight:
    post:
      operationId: preflightRealization
      tags: [realization]
      summary: Preflight realization
      security: [{ bearerAuth: [] }]
      parameters: [{ name: id, in: path, required: true, schema: { type: string, format: uuid } }]
      responses: { "200": { description: Preflight result, content: { application/json: { schema: { $ref: "#/components/schemas/RealizationContract" } } } } }

  /realizations/{id}/execute:
    post:
      operationId: executeRealization
      tags: [realization]
      summary: Execute realization
      security: [{ bearerAuth: [] }]
      parameters: [{ name: id, in: path, required: true, schema: { type: string, format: uuid } }]
      responses: { "200": { description: Execution result, content: { application/json: { schema: { $ref: "#/components/schemas/RealizationActionResult" } } } } }

  /realizations/{id}/retry:
    post:
      operationId: retryRealization
      tags: [realization]
      summary: Retry realization
      security: [{ bearerAuth: [] }]
      parameters: [{ name: id, in: path, required: true, schema: { type: string, format: uuid } }]
      responses: { "200": { description: Retry accepted, content: { application/json: { schema: { $ref: "#/components/schemas/RealizationContract" } } } } }

  /realizations/{id}/qc:
    post:
      operationId: qcRealization
      tags: [realization]
      summary: QC realization
      security: [{ bearerAuth: [] }]
      parameters: [{ name: id, in: path, required: true, schema: { type: string, format: uuid } }]
      responses: { "200": { description: QC result, content: { application/json: { schema: { $ref: "#/components/schemas/RealizationContract" } } } } }

  /realizations/{id}/monitor:
    post:
      operationId: monitorRealization
      tags: [realization]
      summary: Monitor realization
      security: [{ bearerAuth: [] }]
      parameters: [{ name: id, in: path, required: true, schema: { type: string, format: uuid } }]
      responses: { "200": { description: Monitoring result, content: { application/json: { schema: { $ref: "#/components/schemas/RealizationContract" } } } } }

  /realizations/{id}/compensate:
    post:
      operationId: compensateRealization
      tags: [realization]
      summary: Compensate realization
      security: [{ bearerAuth: [] }]
      parameters: [{ name: id, in: path, required: true, schema: { type: string, format: uuid } }]
      responses: { "200": { description: Compensation result, content: { application/json: { schema: { $ref: "#/components/schemas/RealizationContract" } } } } }

\`;

const missingSchemas = \`
    ControlRoomApprovalsResponse:
      type: object
      required: [counts]
      properties:
        pendingItems: { type: array, items: { $ref: "#/components/schemas/ApprovalItem" } }
        recentDecisions: { type: array, items: { $ref: "#/components/schemas/ApprovalDecisionRecord" } }
        unavailableSources: { type: array, items: { type: object, properties: { sourceType: { type: string }, reason: { type: string } } } }
        total: { type: integer }
        catalogTruncated: { type: boolean }
        catalogWarnings: { type: array, items: { type: string } }
        counts:
          type: object
          properties:
            pending: { type: integer }
            slaScheduled: { type: integer }
            slaDueSoon: { type: integer }
            slaOverdue: { type: integer }
            slaExpired: { type: integer }
    ApprovalItem:
      type: object
      required: [subjectType, subjectId, snapshotHash]
      properties:
        subjectType: { type: string }
        subjectId: { type: string }
        subjectVersion: { type: integer, nullable: true }
        status: { type: string }
        snapshotHash: { type: string }
        contextFingerprint: { type: string, nullable: true }
        title: { type: string }
        preview: { type: object, additionalProperties: true, nullable: true }
        previewTruncated: { type: boolean, nullable: true }
        previewWarnings: { type: array, items: { type: string }, nullable: true }
        sla: { $ref: "#/components/schemas/ApprovalSlaSummary" }
    ApprovalDecisionRecord:
      type: object
      required: [decidedAt, actorUserId, resolvedSnapshotHash]
      properties:
        id: { type: string }
        subjectType: { type: string }
        subjectId: { type: string }
        decision: { $ref: "#/components/schemas/ApprovalDecision" }
        reason: { type: string, nullable: true }
        decidedAt: { type: string }
        actorUserId: { type: string }
        resolvedSnapshotHash: { type: string }
        subjectVersion: { type: integer, nullable: true }
        contextFingerprint: { type: string, nullable: true }
    ApprovalDecision:
      type: string
      enum: [approved, rejected, revision_requested]
    ApprovalDecisionInput:
      type: object
      required: [decision, expectedSnapshotHash, idempotencyKey]
      properties:
        decision: { $ref: "#/components/schemas/ApprovalDecision" }
        expectedSnapshotHash: { type: string, minLength: 1 }
        expectedVersion: { type: integer, minimum: 1 }
        reason: { type: string }
        idempotencyKey: { type: string }
    ApprovalDecisionResponse:
      type: object
      properties:
        record: { $ref: "#/components/schemas/ApprovalDecisionRecord" }
    ApprovalSlaInput:
      type: object
      properties:
        subjectSnapshotHash: { type: string }
        dueAt: { type: string }
        warningAt: { type: string }
    ApprovalSlaResponse:
      type: object
      properties:
        sla: { $ref: "#/components/schemas/ApprovalSlaSummary" }
    ApprovalSlaSummary:
      type: object
      properties:
        status: { type: string }
        dueAt: { type: string }
        nextEvent: { type: string }
        deliveredEvents: { type: array, items: { type: string } }
    ConditionalExecutionPolicyInputActionProvider:
      type: string
      enum: [meta_ads, google_ads, tiktok_ads]
    ConditionalExecutionPolicyInput:
      type: object
      additionalProperties: true
    ConditionalExecutionPolicy:
      type: object
      required: [expiresAt, version, enabled]
      properties:
        version: { type: integer }
        enabled: { type: boolean }
        revokedAt: { type: string, nullable: true }
        expiresAt: { type: string }
        masterplanVersionId: { type: string }
        snapshotHash: { type: string }
        contextFingerprint: { type: string }
    ConditionalExecutionAction:
      type: object
      properties:
        actionType: { type: string }
        provider: { type: string }
        accountId: { type: string }
        entityId: { type: string }
        maxActionsPerDay: { type: integer }
    ConditionalExecutionResponse:
      type: object
      properties:
        policy: { $ref: "#/components/schemas/ConditionalExecutionPolicy" }
        action: { $ref: "#/components/schemas/ConditionalExecutionAction" }
        approvedBinding: 
          type: object
          properties:
            masterplanVersionId: { type: string }
            snapshotHash: { type: string }
            contextFingerprint: { type: string }
        eligibility: { type: boolean }
        blockers: { type: array, items: { type: string } }
        intents: { type: array, items: { $ref: "#/components/schemas/ConditionalExecutionIntent" } }
        attempts: { type: array, items: { $ref: "#/components/schemas/ConditionalExecutionAttempt" } }
        events: { type: array, items: { type: object, additionalProperties: true } }
        counts: 
          type: object
          properties:
            intents: { type: integer }
            attempts: { type: integer }
    ConditionalExecutionIntent:
      type: object
      required: [createdAt]
      properties:
        id: { type: string }
        status: { type: string }
        createdAt: { type: string }
        blockCode: { type: string, nullable: true }
    ConditionalExecutionAttempt:
      type: object
      required: [createdAt]
      properties:
        id: { type: string }
        status: { type: string }
        createdAt: { type: string }
        providerReceipt: { type: object, additionalProperties: true, nullable: true }
    ConditionalExecutionPolicyResponse:
      type: object
      properties:
        policy: { $ref: "#/components/schemas/ConditionalExecutionPolicy" }
    RealizationContractInput:
      type: object
      required: [campaignId, masterplanVersionId, subjectId, contextFingerprint, snapshotHash, action, idempotencyKey]
      properties:
        campaignId: { type: string, format: uuid }
        masterplanVersionId: { type: string, format: uuid }
        subjectId: { type: string, format: uuid }
        contextFingerprint: { type: string, minLength: 1 }
        snapshotHash: { type: string, minLength: 1 }
        action: { type: string, enum: [paid_media_pause, paid_media_launch] }
        idempotencyKey: { type: string, minLength: 1 }
        maxAttempts: { type: integer, minimum: 1, maximum: 10, default: 3 }
        target: { type: object, additionalProperties: true }
    RealizationContract:
      type: object
      required: [id, campaignId, masterplanVersionId, subjectId, action, state, idempotencyKey, maxAttempts, attemptsUsed, createdAt, updatedAt]
      properties:
        id: { type: string, format: uuid }
        campaignId: { type: string, format: uuid }
        masterplanVersionId: { type: string, format: uuid }
        subjectId: { type: string, format: uuid }
        subjectType: { type: string }
        action: { type: string, enum: [paid_media_pause, paid_media_launch] }
        state: { type: string }
        idempotencyKey: { type: string }
        bindingHash: { type: string }
        requestFingerprint: { type: string }
        contextFingerprint: { type: string }
        snapshotHash: { type: string }
        binding: { type: object, additionalProperties: true }
        maxAttempts: { type: integer }
        attemptsUsed: { type: integer }
        createdByUserId: { type: string, format: uuid }
        createdAt: { type: string, format: date-time }
        updatedAt: { type: string, format: date-time }
    RealizationAttempt:
      type: object
      required: [id, contractId, number, state, claimedAt]
      properties:
        id: { type: string, format: uuid }
        contractId: { type: string, format: uuid }
        number: { type: integer }
        state: { type: string }
        receipt: { type: object, nullable: true, additionalProperties: true }
        readback: { type: object, nullable: true, additionalProperties: true }
        error: { type: object, nullable: true, additionalProperties: true }
        qc: { type: object, nullable: true, additionalProperties: true }
        retry: { type: object, nullable: true, additionalProperties: true }
        recovery: { type: object, nullable: true, additionalProperties: true }
        compensation: { type: object, nullable: true, additionalProperties: true }
        claimedAt: { type: string, format: date-time }
        completedAt: { type: string, format: date-time, nullable: true }
        leaseOwner: { type: string, nullable: true }
        leaseExpiresAt: { type: string, format: date-time, nullable: true }
    RealizationEvent:
      type: object
      required: [id, contractId, type, details, createdAt]
      properties:
        id: { type: string, format: uuid }
        contractId: { type: string, format: uuid }
        attemptId: { type: string, format: uuid, nullable: true }
        type: { type: string }
        details: { type: object, additionalProperties: true }
        createdAt: { type: string, format: date-time }
    RealizationContractDetail:
      type: object
      required: [contract, attempts, events]
      properties:
        contract: { $ref: "#/components/schemas/RealizationContract" }
        attempts: { type: array, items: { $ref: "#/components/schemas/RealizationAttempt" } }
        events: { type: array, items: { $ref: "#/components/schemas/RealizationEvent" } }
    RealizationActionResult:
      type: object
      required: [success, contract]
      properties:
        success: { type: boolean }
        contract: { $ref: "#/components/schemas/RealizationContract" }
        attempt: { $ref: "#/components/schemas/RealizationAttempt" }
\`;

yaml = yaml.replace(
  '  /campaigns/{campaignId}/control-room/evidence:',
  missingPaths + '\\n  /campaigns/{campaignId}/control-room/evidence:'
);

yaml = yaml.replace(
  '    HealthStatus:',
  missingSchemas + '\\n    HealthStatus:'
);

fs.writeFileSync('lib/api-spec/openapi.yaml', yaml);
