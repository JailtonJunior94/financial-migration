export interface paths {
  "/records": {
    post: {
      requestBody: {
        content: {
          "application/json": components["schemas"]["TargetRecordRequest"];
        };
      };
      responses: {
        201: {
          content: {
            "application/json": components["schemas"]["TargetRecordResponse"];
          };
        };
        409: never;
        422: never;
      };
    };
  };
}

export interface components {
  schemas: {
    TargetRecordRequest: {
      source: string;
      entity: string;
      externalId: string;
      capturedAt: string;
      payload: Record<string, unknown>;
    };
    TargetRecordResponse: {
      id: string;
      status: "accepted" | "duplicate";
    };
  };
}
