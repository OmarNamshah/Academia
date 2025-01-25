# Copyright (c) 2025, SanU and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class TransactionPathTemplate(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from academia.transactions.doctype.template_path.template_path import TemplatePath
		from frappe.types import DF

		template_name: DF.Data
		template_path: DF.Table[TemplatePath]
	# end: auto-generated types
	pass
