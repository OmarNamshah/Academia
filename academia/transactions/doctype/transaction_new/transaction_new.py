# Copyright (c) 2024, SanU and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class TransactionNew(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from academia.transactions.doctype.sub_transactions.sub_transactions import SubTransactions
		from academia.transactions.doctype.transaction_related_documents.transaction_related_documents import TransactionRelatedDocuments
		from frappe.types import DF

		amended_from: DF.Link | None
		company: DF.Link | None
		is_sub_transaction: DF.Check
		naming_series: DF.Literal["TRA-.YY.-.MM.-"]
		parent_transaction: DF.Link | None
		related_documents: DF.Table[TransactionRelatedDocuments]
		start_date: DF.Date | None
		status: DF.Literal["Pending", "Completed", "Canceled", "Closed", "Rejected"]
		sub_transactions: DF.Table[SubTransactions]
		title: DF.Data
		transaction_holder: DF.Link | None
	# end: auto-generated types
	def before_submit(self):
		self.start_date = frappe.utils.today()
