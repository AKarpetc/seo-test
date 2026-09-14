#!/usr/bin/env bash
# Registers the domain in Route 53 using the contact details already on the AWS account.
#
# This is a real purchase (~$16/year, .com) and is intentionally left for a human to run.
# WHOIS privacy protection is enabled, so the registrant address stays out of public WHOIS.
#
# Usage:  ./scripts/ops/register-domain.sh <domain> <registrant-email> [phone]
#   phone is optional and overrides the number on the AWS account, e.g. +7.XXXXXXXXXX

set -euo pipefail

DOMAIN="${1:?usage: register-domain.sh <domain> <registrant-email>}"
EMAIL="${2:?usage: register-domain.sh <domain> <registrant-email> [phone]}"
PHONE_OVERRIDE="${3:-}"
REGION="us-east-1"

command -v aws >/dev/null || { echo "aws cli not found"; exit 1; }

echo "==> Checking availability of ${DOMAIN}"
AVAIL=$(aws route53domains check-domain-availability --region "$REGION" --domain-name "$DOMAIN" --query Availability --output text)
if [ "$AVAIL" != "AVAILABLE" ]; then
  echo "Domain is ${AVAIL}, nothing to do."
  exit 1
fi

PRICE=$(aws route53domains list-prices --region "$REGION" --tld "${DOMAIN##*.}" --query 'Prices[0].RegistrationPrice.Price' --output text)
echo "==> ${DOMAIN} is available. Registration price: \$${PRICE}/year (auto-renew ON)."

aws account get-contact-information > /tmp/aws-contact.json

CONTACT=$(python3 - "$EMAIL" "$PHONE_OVERRIDE" <<'PY'
import json, re, sys
email = sys.argv[1]
override = sys.argv[2] if len(sys.argv) > 2 else ''
c = json.load(open('/tmp/aws-contact.json'))['ContactInformation']

digits = re.sub(r'\D', '', str(c['PhoneNumber']))
# Kazakhstan and Russia share country code 7; "8" is the domestic trunk prefix and is dropped.
if digits.startswith('8') and len(digits) == 11:
    phone = f"+7.{digits[1:]}"
elif digits.startswith('7') and len(digits) == 11:
    phone = f"+7.{digits[1:]}"
elif digits.startswith('1') and len(digits) == 11:
    phone = f"+1.{digits[1:]}"
else:
    phone = f"+{digits[0]}.{digits[1:]}"

if override:
    phone = override

parts = str(c['FullName']).split()
contact = {
    "FirstName": parts[0],
    "LastName": parts[-1] if len(parts) > 1 else parts[0],
    "ContactType": "PERSON",
    "AddressLine1": c['AddressLine1'],
    "City": c['City'],
    "CountryCode": c['CountryCode'],
    "ZipCode": c['PostalCode'],
    "PhoneNumber": phone,
    "Email": email,
}
if c.get('StateOrRegion'):
    contact["State"] = c['StateOrRegion']
print(json.dumps(contact))
PY
)

echo "==> Registrant contact built from the AWS account record."
echo "    Name/address/phone come from 'aws account get-contact-information'."
echo "    ICANN verification will be sent to: ${EMAIL}"
echo "    You MUST click the link in that email within 15 days or the domain is suspended."
echo
read -r -p "Register ${DOMAIN} for \$${PRICE}? [y/N] " CONFIRM
[ "$CONFIRM" = "y" ] || { echo "Cancelled."; exit 0; }

OP=$(aws route53domains register-domain \
  --region "$REGION" \
  --domain-name "$DOMAIN" \
  --duration-in-years 1 \
  --auto-renew \
  --admin-contact "$CONTACT" \
  --registrant-contact "$CONTACT" \
  --tech-contact "$CONTACT" \
  --privacy-protect-admin-contact \
  --privacy-protect-registrant-contact \
  --privacy-protect-tech-contact \
  --query OperationId --output text)

echo "==> Submitted. Operation: ${OP}"
echo "==> Watching status (registration usually completes in a few minutes)..."

for _ in $(seq 1 40); do
  STATUS=$(aws route53domains get-operation-detail --region "$REGION" --operation-id "$OP" --query Status --output text)
  echo "    ${STATUS}"
  case "$STATUS" in
    SUCCESSFUL)
      echo
      echo "Registered. Hosted zone:"
      aws route53 list-hosted-zones --query "HostedZones[?Name=='${DOMAIN}.'].{Name:Name,Id:Id}" --output table
      exit 0
      ;;
    FAILED)
      echo
      aws route53domains get-operation-detail --region "$REGION" --operation-id "$OP" --query Message --output text
      echo
      echo "A previous attempt on this account (ez-dict.com, Feb 2026) also failed this way."
      echo "That pattern usually means the account is not cleared for domain registration."
      echo "Open an AWS Support case: service-domains / registration-issue."
      exit 1
      ;;
  esac
  sleep 15
done

echo "Still pending. Check later with:"
echo "  aws route53domains get-operation-detail --region ${REGION} --operation-id ${OP}"
