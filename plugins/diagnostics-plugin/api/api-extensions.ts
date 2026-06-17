import { gql } from 'graphql-tag';

export const adminApiExtensions = gql`
    type DiagnosticResult {
        "A valid, non-expired diagnostic exists and html is populated."
        available: Boolean!
        "A diagnostic existed but its validity window has passed."
        expired: Boolean!
        title: String
        "Frozen diagnostic HTML, fetched server-to-server from Menata. Null when unavailable/expired."
        html: String
        validUntil: DateTime
        "Where to send the admin to order a new diagnostic (menata.fr)."
        ctaUrl: String
    }

    extend type Query {
        "The current web diagnostic for this client, proxied from the Menata central authority."
        diagnostic: DiagnosticResult!
    }
`;
