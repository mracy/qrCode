// I have imported the libraries
import qrcode from "qrcode";
import invariant from "tiny-invariant";
import db from "../db.server";

//I have created a function to retrieves the qrCodes from database if not it return null
export async function getQRCode(id, graphql) {
console.log('id.', id)
  const qrCode = await db.qRCode.findFirst({ where: { id } });

  if (!qrCode) {
    return null;
  }

  return supplementQRCode(qrCode, graphql);
}

// This will generate multiple qrCodes
export async function getQRCodes(shop, graphql) {
  const qrCodes = await db.qRCode.findMany({
    where: { shop },
    orderBy: { id: "desc" },
  });

  if (qrCodes.length === 0) return [];

  return Promise.all(
    qrCodes.map((qrCode) => supplementQRCode(qrCode, graphql))
  );
}

//This code will generate qrCode for specific id and also handles the specific product and when it is a product variant.
export function getQRCodeImage(id) {
  const url = new URL(`/qrcodes/${id}/scan`, process.env.SHOPIFY_APP_URL);
  return qrcode.toDataURL(url.href);
}

//generates a destination URL on type of qrCodes
export function getDestinationUrl(qrCode) {
  if (qrCode.destination === "product") {
    return `https://${qrCode.shop}/products/${qrCode.productHandle}`;
  }

  const match = /gid:\/\/shopify\/ProductVariant\/([0-9]+)/.exec(qrCode.productVariantId);
  invariant(match, "Unrecognized product variant ID");

  return `https://${qrCode.shop}/cart/${match[1]}:1`;
}



// additional data fetched from a GraphQL API and generates a QR code image URL
  async function supplementQRCode(qrCode, graphql) {
    const qrCodeImagePromise = getQRCodeImage(qrCode.id);

    const response = await graphql(
      `
        query supplementQRCode($id: ID!) {
          product(id: $id) {
            title
            images(first: 1) {
              nodes {
                altText
                url
              }
            }
          }
        }
      `,
      {
        variables: {
          id: qrCode.productId,
        },
      }
    );

    const {
      data: { product },
    } = await response.json();


    return {
      ...qrCode,
      productDeleted: !product?.title,
      productTitle: product?.title,
      productImage: product?.images?.nodes[0]?.url,
      productAlt: product?.images?.nodes[0]?.altText,
      //productVariantId: product?.variantId,
      destinationUrl: getDestinationUrl(qrCode),
      image: await qrCodeImagePromise,
    };
  }

  //checks whether certain required fields in a QR code data object are present and valid and If any required fields are missing, it returns an object containing error messages for each missing field
  export function validateQRCode(data) {
    const errors = {};

    if (!data.title) {
      errors.title = "Title is required";
    }

    if (!data.productId) {
      errors.productId = "Product is required";
    }

    if (!data.destination) {
      errors.destination = "Destination is required";
    }

    if (Object.keys(errors).length) {
      return errors;
    }
  }




