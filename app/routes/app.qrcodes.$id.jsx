//import the libraries

import { useState } from "react";
import { json, redirect } from "@remix-run/node";
import {
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
  useNavigate,
} from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Card,
  Bleed,
  Button,
  ChoiceList,
  Divider,
  EmptyState,
  InlineStack,
  InlineError,
  Layout,
  Page,
  Text,
  TextField,
  Thumbnail,
  BlockStack,
  PageActions,
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";

import db from "../db.server";
import { getQRCode, validateQRCode } from "../models/QRCode.server";

//handles requests based on parameters and returns JSON data
//return the data
export async function loader({ request, params }) {
  try {
    const { admin } = await authenticate.admin(request);

    const  id  = params.id;

    if (id === "new") {
      return json({
        destination: "product",
        title: "",
      });
    }

    // Ensure the ID is valid, as a string
    if (!id || typeof id !== 'string') {
      throw new Error("Invalid ID: ID must be a valid string.");
    }

  // I have printed replicaData here to find the issue
    return json(await getQRCode(id, admin.graphql));
  } catch (error) {
    console.error("Error in loader:", error);
    return json({ error: error.message }, { status: 400 });
  }
}




//perform the crud operation to post the data into web application
export async function action({ request, params }) {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  /** @type {any} */
  const dataDummy = {
    ...Object.fromEntries(await request.formData()),
    shop,
  };
const data ={...dataDummy,productVariantId:Array.isArray(dataDummy.productVariantId) ? dataDummy.productVariantId : [dataDummy.productVariantId]}


console.log("receiving",data)

  if (data.action === "delete") {
    await db.qRCode.delete({ where: { id: String(params.id) } });
    return redirect("/app");
  }

  const errors = validateQRCode(data);

  if (errors) {
    return json({ errors }, { status: 422 });
  }
  const qrCode =
    params.id === "new"
      ? await db.qRCode.create({ data })
      : await db.qRCode.update({ where: { id: String(params.id) }, data });

  return redirect(`/app/qrcodes/${qrCode.id}`);
}

//function component is a React functional component that manages a form for creating or editing QR codes. It uses various React hooks and state management techniques to handle form data, validate it, and manage submission states
export default function QRCodeForm() {
  const errors = useActionData()?.errors || {};

  const qrCode = useLoaderData();
  const [formState, setFormState] = useState(qrCode);
  const [cleanFormState, setCleanFormState] = useState(qrCode);
  const isDirty = JSON.stringify(formState) !== JSON.stringify(cleanFormState);

  //console.log("test",qrCode,"------------------",formState)

  const nav = useNavigation();
  const isSaving =
    nav.state === "submitting" && nav.formData?.get("action") !== "delete";
  const isDeleting =
    nav.state === "submitting" && nav.formData?.get("action") === "delete";

  const navigate = useNavigate();



  //functions handle product selection and form submission in a React component
  async function selectProduct() {
    // Retrieve the currently selected product ID and variant IDs from the form state
    const selectedProductId = formState.productId;
    const productVariantId = Array.isArray(formState.productVariantId)
      ? formState.productVariantId
      : [formState.productVariantId].filter(Boolean); // Convert to array if it's a string and remove empty

    try {
      // Open the Shopify resource picker
      const { selection } = await window.shopify.resourcePicker({
        type: "product",
        action: "select",
        variants: true, // Allow variant selection
        selectionIds: selectedProductId
          ? [
              {
                id: selectedProductId,
                variants: productVariantId[0]
                  ? productVariantId[0].split(',').map(variantId => ({ id: variantId }))
                  : [],
              },
            ]
          : [],
      });

      console.log("Selected products and variants:", selection);

      // If products were selected, update the form state
      if (selection && selection.length > 0) {
        const selectedProduct = selection[0];
        const { images, id, title, handle, variants } = selectedProduct;

        // Get all selected variant IDs or default to all if none were selected
        const selectedVariantIds = variants
          .filter((variant) => productVariantId.includes(variant.id))
          .map((variant) => variant.id);

        // If no specific variants are selected, consider all variants
        const allVariantIds = variants.map((variant) => variant.id);

        // Ensure state updates correctly with the new values
        setFormState((prevState) => ({
          ...prevState,
          productId: id,
          productVariantId: selectedVariantIds.length > 0 ? selectedVariantIds : allVariantIds, // Use selected or all variants
          productTitle: title,
          productHandle: handle,
          productAlt: images[0]?.altText || '',
          productImage: images[0]?.originalSrc || '',
          isSelected: true, // Mark the product as selected
        }));

        console.log(`Updated form state with product ID: ${id}`);
        console.log(`Updated form state with variant IDs: ${selectedVariantIds.join(", ")}`);
      }
    } catch (error) {
      console.error('Error selecting product:', error);
    }
  }

  const submit = useSubmit();

  function handleSave() {
    const data = {
      title: formState.title,
      productId: formState.productId || "",
      productVariantId: Array.isArray(formState.productVariantId) ? formState.productVariantId : [], // Ensure it's an array
      productHandle: formState.productHandle || [],
      destination: formState.destination,
    };

    console.log("Submitting data:", data); // Add logging to check data

    setCleanFormState({ ...formState });
    submit(data, { method: "post" });
  }


  //React component that renders a form for creating or editing QR codes and to build a user interface where users can input QR code details, select products, and view or download the generated QR code

  return (
      <Page>
        <ui-title-bar title={qrCode.id ? "Edit QR code" : "Create new QR code"}>
          <button variant="breadcrumb" onClick={() => navigate("/app")}>
            QR codes
          </button>
        </ui-title-bar>
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="500">
                  <Text as={"h2"} variant="headingLg">
                    Title
                  </Text>
                  <TextField
                    id="title"
                    helpText="Only store staff can see this title"
                    label="title"
                    labelHidden
                    autoComplete="off"
                    value={formState.title}
                    onChange={(title) => setFormState({ ...formState, title })}
                    error={errors.title}
                  />
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="500">
                  <InlineStack align="space-between">
                    <Text as={"h2"} variant="headingLg">
                      Product
                    </Text>
                    {formState.productId ? (
                      <Button variant="plain" onClick={selectProduct}>
                        Change product
                      </Button>
                    ) : null}
                  </InlineStack>
                  {formState.productId ? (
                    <InlineStack blockAlign="center" gap="500">
                      <Thumbnail
                        source={formState.productImage || ImageIcon}
                        alt={formState.productAlt}
                      />
                      <Text as="span" variant="headingMd" fontWeight="semibold">
                        {formState.productTitle}
                      </Text>
                    </InlineStack>
                  ) : (
                    <BlockStack gap="200">
                      <Button onClick={selectProduct} id="select-product">
                        Select product
                      </Button>
                      {errors.productId ? (
                        <InlineError
                          message={errors.productId}
                          fieldID="myFieldID"
                        />
                      ) : null}
                    </BlockStack>
                  )}
                  <Bleed marginInlineStart="200" marginInlineEnd="200">
                    <Divider />
                  </Bleed>
                  <InlineStack gap="500" align="space-between" blockAlign="start">
                    <ChoiceList
                      title="Scan destination"
                      choices={[
                        { label: "Link to product page", value: "product" },
                        {
                          label: "Link to checkout page with product in the cart",
                          value: "cart",
                        },
                      ]}
                      selected={[formState.destination]}
                      onChange={(destination) =>
                        setFormState({
                          ...formState,
                          destination: destination[0],
                        })
                      }
                      error={errors.destination}
                    />
                    {qrCode.destinationUrl ? (
                      <Button
                        variant="plain"
                        url={qrCode.destinationUrl}
                        target="_blank"
                      >
                        Go to destination URL
                      </Button>
                    ) : null}
                  </InlineStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <Text as={"h2"} variant="headingLg">
                QR code
              </Text>
              {qrCode ? (
                <EmptyState image={qrCode.image} imageContained={true} />
              ) : (
                <EmptyState image="">
                  Your QR code will appear here after you save
                </EmptyState>
              )}
              <BlockStack gap="300">
                <Button
                  disabled={!qrCode?.image}
                  url={qrCode?.image}
                  download
                  variant="primary"
                >
                  Download
                </Button>
                <Button
                  disabled={!qrCode.id}
                  url={`/qrcodes/${qrCode.id}`}
                  target="_blank"
                >
                  Go to public URL
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section>
            <PageActions
              secondaryActions={[
                {
                  content: "Delete",
                  loading: isDeleting,
                  disabled: !qrCode.id || !qrCode || isSaving || isDeleting,
                  destructive: true,
                  outline: true,
                  onAction: () =>
                    submit({ action: "delete" }, { method: "post" }),
                },
              ]}
              primaryAction={{
                content: "Save",
                loading: isSaving,
                disabled: !isDirty || isSaving || isDeleting,
                onAction: handleSave,
              }}
            />
          </Layout.Section>
        </Layout>
      </Page>
    );
  }
