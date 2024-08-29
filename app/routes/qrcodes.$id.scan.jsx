//importing libraries

import { redirect } from "@remix-run/node";
import invariant from "tiny-invariant";
import db from "../db.server";

import { getDestinationUrl } from "../models/QRCode.server";

//handles requests to a specific QR code route (based on the id parameter)
export const loader = async ({ params }) => {
  invariant(params.id, "Could not find QR code destination");

  const id = (params.id);
  const qrCode = await db.qRCode.findFirst({ where: { id } });

  invariant(qrCode, "Could not find QR code destination");

  await db.qRCode.update({
    where: { id: id },
    data: { scans: { increment: 1 } },
  });

  return redirect(getDestinationUrl(qrCode));
};
